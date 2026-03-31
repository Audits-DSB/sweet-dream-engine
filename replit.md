# DSB - Operations & Business Management App

## Overview
A full-featured React + TypeScript operations management dashboard for a dental supply company (DSB). Manages clients, orders, deliveries, inventory, collections, suppliers, treasury, founders, reports, and user management. All business data stored in Supabase PostgreSQL.

## Architecture
- **Frontend**: React 18 + TypeScript + Vite (proxied via Express on port 5000)
- **Backend**: Express.js API server (port 5000, Vite on 5001)
- **Database**: Supabase PostgreSQL (project `nhmrwmseowokjiqccsjd`) — ALL business data
- **Catalog DB**: Secondary Supabase project (`qelguwdtxlyhulrtfyyb`) — product catalog (full CRUD via `/api/external-materials`)
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
- `orders` — Customer orders (includes `delivery_fee_bearer` column: "client" or "company" — when "company", delivery fee is deducted from profit before company/founders split; `delivery_fee_paid_by_founder` column tracks which founder paid the delivery fee for reimbursement at collection time; `order_cost_paid_by_founder` column stores JSON map of `{founderId: amountPaid}` for multi-founder partial cost payments)
- `requests` — Client requests
- `deliveries` — Delivery records (columns: id, orderId, clientId, date, scheduledDate, status, deliveredBy, deliveryFee, items, notes)
- `collections` — Invoice/collection records
- `inventory` — Inventory lots
- `notifications` — System notifications
- `treasury_accounts` — Treasury/cash accounts
- `treasury_transactions` — All financial transactions including:
  - Standard: inflow, expense, withdrawal, transfer
  - Founder transactions: founder_contribution, founder_withdrawal, order_funding (stored with performedBy=founderId, referenceId=founderName, linkedAccountId=orderId, category=method)

## Soft-Delete & Trash System
- **Soft-Delete**: All DELETE routes snapshot the entity BEFORE physical deletion and save to `deleted_items` table in **Supabase** (via `supabaseAdmin`)
- **`deleted_items` table**: Columns — id, entity_type, entity_id, entity_name, snapshot (jsonb), related_data (jsonb), deleted_at, deleted_by
- **Trash Page** (`src/pages/Trash.tsx`) — Full trash management: type-filter badges, search, expand/collapse snapshot details, restore, permanent delete, clear-all
- **Trash API Endpoints**: `GET /api/trash`, `GET /api/trash/count`, `POST /api/trash/:id/restore`, `DELETE /api/trash/:id`, `DELETE /api/trash`
- **Cascade Restore**: Orders restore with all related records (order_lines, founder_contributions, deliveries, collections, client_inventory, audits). Suppliers restore with materials. Treasury accounts restore with transactions. Founders restore linked delivery actors.
- **ConfirmDeleteDialog** (`src/components/ConfirmDeleteDialog.tsx`) — Reusable confirmation dialog before any delete
- **auditLog utility** (`src/lib/auditLog.ts`) — Logs create/update/delete operations to `notifications` table for activity tracking. All pages pass `performedBy: profile?.full_name` to track who performed each action.
- **Activity Page** (`src/pages/Activity.tsx`) — Displays audit history grouped by date. Supports `?highlight=<id>` query param to auto-scroll to and highlight a specific entry. Entity names are clickable links that navigate to the relevant page (order details, client profile, etc.).
- **NotificationBell** (`src/components/NotificationBell.tsx`) — Clicking a notification navigates to `/activity?highlight=<id>` to show full details before navigating to the entity.
- **Order Cascade Delete**: Deleting an order also deletes all related records. Full related data is saved in the trash snapshot.
- **Order Cascade Restore**: `POST /orders/:id/cascade-restore` re-creates the order and all related records from the saved snapshot.

## Key API Endpoints (server/routes.ts)
- `/api/clients`, `/api/suppliers`, `/api/materials`, `/api/founders` — CRUD
- `/api/orders`, `/api/orders/next-id` — Orders CRUD + auto-increment ID
- `/api/orders/:id/lines` — POST: add new materials to existing order; GET: fetch order lines
- `/api/order-lines/:id` — PATCH: update line qty/price; DELETE: remove a line from order
- `/api/requests`, `/api/deliveries`, `/api/collections` — CRUD
- `/api/inventory`, `/api/notifications` — CRUD
- `/api/treasury/accounts`, `/api/treasury/transactions` — Treasury CRUD (supports deposit via txType "deposit")
- `/api/founder-transactions` — Founder financial transactions (GET/POST/DELETE, uses treasury_transactions table)
- `/api/founder-balances` — Computed founder capital balances (joins orders + order_founder_contributions + order_lines + treasury_transactions)
- `/api/company-profit-summary` — Total company profit from collections minus expenses (handles line-item, sourceOrders, and single-order paths)
- `/api/external-materials` — Full CRUD for catalog Supabase project (GET list, POST add one/many, PATCH update, DELETE)
- `/api/external-materials/export` — Download all materials as CSV file
- **CSV Import**: Materials page supports bulk import from CSV files with preview before inserting
- **Dependencies**: `papaparse` for CSV parsing on frontend

## Monthly Detail Drill-Down
- **Route**: `/monthly/:year/:month` — Detailed view of all activity for a specific month
- **Page**: `src/pages/MonthlyDetail.tsx` — Shows orders, deliveries, collections, and KPI summary for the selected month
- **Chart Click Navigation**: All monthly charts in Dashboard and FinancialReport navigate to the monthly detail page on click
- **Data**: Each chart data point includes `ym` (Dashboard) or `monthKey` (FinancialReport) for navigation

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

## Order Lifecycle Pipeline
- **Visual stepper** on OrderDetails page: Processing → Delivery → Inventory → Collection
- Each step auto-highlights based on real data (deliveries, client_inventory, collections linked to order)
- Below the stepper, expandable detail sections show all linked records with dates and clickable links
- **Orders list page** shows 3 lifecycle columns: التوصيل (delivery count), الجرد (inventory count), التحصيل (collection progress)
- All columns are clickable → navigate to filtered views
- Inventory page supports `?sourceOrder=ORD-xxx` URL filter with order banner
- Server auto-updates order status to "Processing" when delivery is first created

## Orders Page Enhancements
- **Stats cards**: 5 KPI cards at top (total sales, expected profit, مخزون محتجز/inventory held value, active orders, collection %). Sales and profit stats EXCLUDE inventory orders (clientId=company-inventory) — inventory value shown separately
- **Date filter**: Today, last week, this month, last 3 months, all periods
- **Client & supplier filter dropdowns**: Filter by specific client or supplier
- **Sortable columns**: Click column headers to sort (order #, client, date, materials, selling, profit, status)
- **Profit column**: Shows expected profit per order (selling - cost), color-coded (green/red). Inventory orders show "مخزون" badge instead of negative profit
- **Materials count column**: Shows number of line items per order
- **Row coloring**: Subtle background colors by status (green=closed, red=cancelled, amber=in-progress)
- **Quick status change**: Click status badge in table to change status via dropdown (no need to open order details)
- **Overdue warning**: Triangle icon on orders stuck in processing for 7+ days with no delivery/inventory activity
- **Notes tooltip**: Sticky note icon on orders that have notes (hover to see)
- **Duplicate order**: Functional "copy order" action — creates new order with same items, client, and supplier
- **Pagination**: 25 orders per page with page navigation controls
- **Supplier search**: Search bar also matches supplier names

## Refill Planning Enhancements
- **Last supplier column**: Each material in the refill table shows the last supplier that provided it (from order_lines history)
- **Last cost price column**: Shows the last purchase price for each material
- **Last order date column**: Shows when material was last ordered, with "طلب قائم" warning if it's in a pending order (Draft/Processing/Confirmed)
- **Supplier filter dropdown**: Filter materials by their last known supplier
- **Editable quantities**: In the confirmation dialog, each material's quantity can be adjusted before creating the order
- **Pending order warning**: Materials already in active orders show amber warning to prevent double-ordering
- **Confirmation dialog**: Shows summary (material count, estimated cost, suppliers) with editable quantities before creating the order
- **Convert to Order button**: Selected items with shortages are directly converted to an order via API with auto-filled cost prices, navigating to order details
- **Auto supplier + cost linking**: When converting to order, each material line is automatically assigned its last known supplier and cost price
- **Server endpoint**: `GET /api/material-last-suppliers` returns `{ materials: {code → {supplierId, supplierName, lastCostPrice, lastOrderDate}}, pending: {code → orderIds[]} }`
- **Per-line supplier editing**: OrderDetails edit mode now has supplier dropdown on each existing and new line item

## Delivery-Order Sync System
- **Per-line delivery tracking**: OrderDetails.tsx computes delivered/remaining quantities per order line from all linked deliveries
- **Partial delivery items**: Stored as JSON in delivery `notes` field: `{ type: "جزئي", items: [{ lineId, materialCode, materialName, qty, unit }] }`
- **Full delivery**: `notes` is plain text "كامل" or empty — marks all lines as delivered
- **Auto status sync**: When delivery is confirmed (PATCH /deliveries/:id → status "Delivered"), server auto-updates order status:
  - All lines fully delivered → order status = "Delivered"
  - Some lines delivered → order status = "Partially Delivered"
- **Invoice tab**: Shows delivery progress banner + per-line delivery badges with progress bars
- **Deliveries tab**: Shows parsed partial items in cards (not raw JSON), delivery status per item

## Company Inventory System
- **Table**: `company_inventory` — lot-based tracking (id, material_code, material_name, unit, lot_number, quantity, remaining, cost_price, source_order, date_added, status)
- **Order Types**: `orders.order_type` column — 'client' (default) or 'inventory' (for company stock purchases)
- **Inventory Pull**: `order_lines.from_inventory` boolean + `inventory_lot_id` text — when pulling from company inventory for client orders
- **API Endpoints**: GET/POST/PATCH/DELETE `/api/company-inventory`, GET `/api/company-inventory/:id`, POST `/api/company-inventory/withdraw`
- **Pages**: `src/pages/CompanyInventory.tsx` — lot list with filters/stats; `src/pages/InventoryLotDetail.tsx` — lot detail page (image, usage bar, source order link)
- **Inventory Badges on Order Lines**: Lines pulled from inventory show "مخزون" badge + clickable lot ID linking to `/company-inventory/:lotId`
- **Sidebar**: "مخزون الشركة" link under Inventory section
- **Order Creation**: Toggle between "لعميل" (client order) and "للمخزون" (inventory purchase). Inventory orders set client="مخزون الشركة", selling price=0
- **Inventory Pull in Orders**: "سحب من المخزون" button shows available company inventory lots; pulled items use original lot cost price for accurate profit calculations
- **Founder Funding for Inventory Items**: Items pulled from company inventory (fromInventory=true) are excluded from founder contribution calculations — founders already paid when the inventory was purchased. No duplicate treasury transactions are created. Full cost is preserved in totalCost for correct profit distribution.
- **Delivery Logic**: When delivery confirmed for inventory-type orders, items go to `company_inventory` instead of `client_inventory`
- **Migration**: POST `/api/migrate/company-inventory` checks and reports schema status

## Supplier Integration System
- **Supplier Profile Page** (`src/pages/SupplierProfile.tsx`) — Route `/suppliers/:id`, shows full supplier details, stats, orders, inventory lots, materials, and analytics (monthly purchase chart, supplier statement). Includes edit dialog and delete with confirmation + audit logging.
- **API Endpoints**:
  - `GET /api/suppliers/:id/profile` — Aggregated supplier data (supplier info + orders + inventory + materials + computed stats)
  - `GET /api/suppliers-stats` — Summary stats for all suppliers (order count, total purchases, last order date, materials count, lots count)
- **Suppliers List**: Cards show stats, clicking any card navigates directly to supplier profile page
- **Per-Line Supplier ("المورد الحالي" Flow)**:
  - Order creation: "المورد الحالي" dropdown at top — user selects supplier, then adds materials; each added material auto-inherits the current supplier
  - User can switch suppliers mid-entry and keep adding materials from different suppliers
  - Supplier name shown as read-only badge on each line item (no per-item dropdown — streamlined UX)
  - Same flow in OrderDetails edit: order-level supplier dropdown, new items inherit it
  - Per-line `supplier_id` saved to `order_lines` table in Supabase
  - Order-level `supplier_id` saved to `orders` table (represents primary supplier)
- **Supplier Display**: Supplier name clickable everywhere (Orders table, OrderDetails header/info, per-line badges, CompanyInventory) → navigates to supplier profile
- **Data Model**: `suppliers` table, `supplier_materials` join table, `orders.supplier_id`, `order_lines.supplier_id`, `company_inventory.supplier_id`

## Notes
- API returns camelCase; Supabase stores snake_case. Helpers `camelizeKeys`/`snakifyKeys` handle conversion in routes.ts
- Seed runs only once when `clients` table is empty
- Founder transactions are stored in `treasury_transactions` with special txTypes (founder_contribution, founder_withdrawal, order_funding) to avoid needing a new table
- `src/data/store.ts` contains static fallback data; most pages now use live API data
