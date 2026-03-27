# DSB - Operations & Business Management App

## Overview
A full-featured React + TypeScript operations management dashboard for a dental supply company (DSB). Manages clients, orders, deliveries, inventory, collections, suppliers, treasury, founders, reports, and user management. All business data stored in Supabase PostgreSQL.

## Architecture
- **Frontend**: React 18 + TypeScript + Vite (proxied via Express on port 5000)
- **Backend**: Express.js API server (port 5000, Vite on 5001)
- **Database**: Supabase PostgreSQL (project `nhmrwmseowokjiqccsjd`) — ALL business data
- **Catalog DB**: Secondary Supabase project (`qelguwdtxlyhulrtfyyb`) — 306-product catalog (read-only via `/api/external-materials`)
- **Auth**: Supabase Auth (email/password + OAuth via `@supabase/supabase-js`)
- **UI**: Tailwind CSS + shadcn/ui + Radix UI components
- **Routing**: React Router v6
- **State**: TanStack React Query v5 + React Context (AuthContext, LanguageContext)
- **Charts**: Recharts
- **Design**: RTL Arabic, IBM Plex Sans Arabic font, orange primary color theme

## Database Tables (Supabase PostgreSQL)
All business data in main Supabase project:
- `clients` — Client records
- `suppliers` — Supplier records
- `materials` — Product/material catalog
- `founders` — Company founders (fields: id, name, alias, email, phone, totalContributed, totalWithdrawn, active)
- `orders` — Customer orders
- `requests` — Client requests
- `deliveries` — Delivery records (columns: id, orderId, clientId, date, scheduledDate, status, deliveredBy, deliveryFee, items, notes)
- `collections` — Invoice/collection records
- `inventory` — Inventory lots
- `notifications` — System notifications
- `treasury_accounts` — Treasury/cash accounts
- `treasury_transactions` — All financial transactions including:
  - Standard: inflow, expense, withdrawal, transfer
  - Founder transactions: founder_contribution, founder_withdrawal, order_funding (stored with performedBy=founderId, referenceId=founderName, linkedAccountId=orderId, category=method)

## Delete & Audit Log System
- **ConfirmDeleteDialog** (`src/components/ConfirmDeleteDialog.tsx`) — Reusable confirmation dialog before any delete
- **auditLog utility** (`src/lib/auditLog.ts`) — Logs all create/update/delete operations to `notifications` table (type: `audit_create`/`audit_update`/`audit_delete`) with full entity snapshot for restore
- **Activity Page** (`src/pages/Activity.tsx`) — Displays audit history grouped by date; allows restoring deleted items by re-inserting the snapshot via API
- **Delete enabled on**: Clients, Orders, Deliveries, Suppliers, Collections, Materials, Founders (all with confirmation dialog + audit log)
- **Restore**: Activity page reads `notifications` where type starts with `audit_`, shows "استعادة" button for deleted items

## Key API Endpoints (server/routes.ts)
- `/api/clients`, `/api/suppliers`, `/api/materials`, `/api/founders` — CRUD
- `/api/orders`, `/api/orders/next-id` — Orders CRUD + auto-increment ID
- `/api/requests`, `/api/deliveries`, `/api/collections` — CRUD
- `/api/inventory`, `/api/notifications` — CRUD
- `/api/treasury/accounts`, `/api/treasury/transactions` — Treasury CRUD
- `/api/founder-transactions` — Founder financial transactions (GET/POST/DELETE, uses treasury_transactions table)
- `/api/external-materials` — Proxy to catalog Supabase project

## Key Files
- `server/index.ts` — Express entry point, seeds data on first run, proxies Vite on 5001
- `server/routes.ts` — All CRUD API endpoints, camelCase↔snake_case helpers
- `src/lib/api.ts` — Frontend API client (fetch wrapper to /api/*)
- `src/lib/orderProfit.ts` — **Central calculation library** (single source of truth for all business math)
  - `calculateOrderProfit()` — Full calculation with per-founder breakdown
  - `quickProfit()` — Simplified version returning key numbers (expectedProfit, realizedProfit, recoveredCapital, companyProfit, foundersProfit)
  - `founderSplit()` — Distributes profit/capital across founders (equal or weighted mode)
  - All formulas: capital=orderTotal-expectedProfit, profitRatio=expectedProfit/orderTotal, realizedProfit=paidValue*profitRatio, recoveredCapital=paidValue*capitalRatio, companyProfit=realizedProfit*companyPct, foundersProfit=realizedProfit-companyProfit
  - Used by: Collections.tsx, CompanyProfit.tsx, Founders.tsx, OrderDetails.tsx, TreasuryAccounts.tsx, server/routes.ts
- `src/data/store.ts` — Static seed data (used for initial Supabase seeding only)

## Finance Section (fully dynamic from DB)
- `CompanyProfit.tsx` — P&L from orders + treasury_transactions, expense tracking
- `FounderFunding.tsx` — Founder transactions (contributions/withdrawals/order funding) via `/api/founder-transactions`
- `FinancialReport.tsx` — Aggregate report: P&L from orders, collections summary from collections, founder distributions from founder-transactions + founders
- `Collections.tsx` — Invoice tracking, payment recording, links to treasury
- `Treasury.tsx`, `TreasuryAccounts.tsx`, `TreasuryTransactions.tsx` — Treasury management

## Environment Variables (Replit Secrets)
- `VITE_SUPABASE_URL` — Main Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key for server-side operations
- `EXTERNAL_SUPABASE_URL` — Catalog Supabase project URL
- `EXTERNAL_SUPABASE_ANON_KEY` — Catalog Supabase anon key

## Running the App
```bash
npx tsx server/index.ts   # starts Express on 5000, spawns Vite on 5001
```

## Notes
- API returns camelCase; Supabase stores snake_case. Helpers `camelizeKeys`/`snakifyKeys` handle conversion in routes.ts
- Seed runs only once when `clients` table is empty
- Founder transactions are stored in `treasury_transactions` with special txTypes (founder_contribution, founder_withdrawal, order_funding) to avoid needing a new table
- `src/data/store.ts` contains static fallback data; most pages now use live API data
