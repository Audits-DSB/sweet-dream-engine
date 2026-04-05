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
- **Charts**: Recharts (used in FounderProfile for profit/capital/funding visualizations)
- **Design**: Bilingual (AR/EN) via LanguageContext, RTL Arabic / LTR English, Cairo/Tajawal/IBM Plex Sans Arabic fonts, orange primary color theme
- **i18n**: `src/i18n/ar.ts` and `src/i18n/en.ts` — flat key-value translation files. Client report keys prefixed with `cr`. Type derived from `ar.ts`.

## Database Tables (Supabase PostgreSQL)
All business data in main Supabase project:
- `clients` — Client records
- `suppliers` — Supplier records
- `materials` — Product/material catalog
- `founders` — Company founders (fields: id, name, alias, email, phone, totalContributed, totalWithdrawn, active)
- `orders` — Customer orders (includes `delivery_fee_bearer` column: "client" or "company" — when "company", delivery fee is deducted from profit before company/founders split; `delivery_fee_paid_by_founder` column tracks which founder paid the delivery fee for reimbursement at collection time; `order_cost_paid_by_founder` column stores JSON map of `{founderId: amountPaid}` for multi-founder partial cost payments; `supplier_id` is order-level default, but each `order_line` can have its own `supplier_id` — the orders list shows ALL unique suppliers from lines)
- `requests` — Client requests
- `deliveries` — Delivery records (columns: id, orderId, clientId, date, scheduledDate, status, deliveredBy, deliveryFee, items, notes)
- `collections` — Invoice/collection records
- `inventory` — Inventory lots
- `returns` — Return/refund records (id, order_id, client_id, client_name, return_date, reason, status [pending/accepted/rejected], total_value, total_cost, disposition [company_inventory/return_to_supplier], refund_status, refund_amount, items jsonb, notes, processed_by, created_at). **NOTE**: Must be created manually via Supabase SQL Editor (exec_sql RPC unavailable).
- `notifications` — System notifications
- `treasury_accounts` — Treasury/cash accounts
- `treasury_transactions` — All financial transactions including:
  - Standard: inflow, expense, withdrawal, transfer
  - Founder transactions: founder_contribution, founder_withdrawal, capital_withdrawal, order_funding (stored with performedBy=founderId, referenceId=founderName, linkedAccountId=orderId, category=method)
  - When paying founder order funding, user chooses: cash only, balance only, or mixed (capital_withdrawal tx created for balance portion)

## Return-Aware Financial Calculations
All financial pages and server endpoints account for returns:
- **CompanyProfit.tsx**: Excludes "مرتجع كلي" orders from profit ledger. Adjusts "مرتجع جزئي" by subtracting returned items' selling/cost values.
- **FinancialReport.tsx**: Fetches returns, subtracts return deductions from monthly P&L revenue/cost. Includes partial returns in delivered statuses.
- **Dashboard.tsx**: Fetches returns, adjusts delivered orders' revenue/cost stats with return deductions.
- **MonthlyDetail.tsx**: Fetches returns, excludes "مرتجع كلي", adjusts revenue/cost/profit with return deductions. Includes "مرتجع جزئي" in delivered statuses.
- **MonthlyReport.tsx**: Fetches returns, excludes "مرتجع كلي", adjusts total revenue and daily chart data with return deductions.
- **Founders.tsx**: Fetches returns, excludes "مرتجع كلي" from order map, adjusts selling/cost with return deductions before profit/capital calculations. Return refunds also create `capital_return` transactions which add to founder capital balance via `founderCapitalBalance()`.
- **Server `/company-profit-summary`**: Fetches returns table, excludes fully-returned orders, adjusts partial returns.
- **Server `/founder-balances`**: Fetches returns table, excludes "مرتجع كلي" orders, adjusts selling/cost for partial returns, includes `autoDeliveryReimbursement` in balance calculation.
- **Return deduction pattern**: Each page builds a `returnDeductions` map: `{ orderId → { returnedSelling, returnedCost } }` from accepted returns' item quantities × prices.
- **OrderDetails.tsx**: Post-return financials shown inline when accepted returns exist. Invoice tab shows return deduction + net total. Financials tab shows net revenue/cost/profit after returns, adjusted profit distribution (company/founders), and per-founder net profit share. Uses `quickProfit()` with return-adjusted inputs.
- **Founder refund on return accept**: When a return is accepted, the purchase cost is split among the founders who funded the order. This works for BOTH dispositions: `company_inventory` (immediate refund) and `return_to_supplier` + `refunded` (immediate refund). For `return_to_supplier` + `pending_refund`, refund happens via the separate `/returns/:id/confirm-refund` endpoint. Founder refunds create `capital_return` treasury transactions with category `return_refund`.
- **Repair endpoint**: `POST /api/returns/:id/repair-refund` — Retroactively creates missing founder refund transactions for accepted returns that were processed before the refund logic was fixed. Handles both camelCase and snake_case item keys. Deletes zero-amount transactions and recreates them with correct amounts.

## Soft-Delete & Trash System
- **Soft-Delete**: All DELETE routes snapshot the entity BEFORE physical deletion and save to `deleted_items` table in **Supabase** (via `supabaseAdmin`)
- **`deleted_items` table**: Columns — id, entity_type, entity_id, entity_name, snapshot (jsonb), related_data (jsonb), deleted_at, deleted_by
- **Trash Page** (`src/pages/Trash.tsx`) — Full trash management: type-filter badges, search, expand/collapse snapshot details, restore, permanent delete, clear-all
- **Trash API Endpoints**: `GET /api/trash`, `GET /api/trash/count`, `POST /api/trash/:id/restore`, `DELETE /api/trash/:id`, `DELETE /api/trash`
- **Full Cascade Delete & Restore** (all entities):
  - **Order**: cascade-deletes lines, contributions, deliveries, collections, client_inventory, company_inventory, audits, returns, ALL treasury_transactions (order_funding, capital_return, capital_withdrawal, founder_contribution, inflow, expense — matched by orderId in description or text match), linked_collections. Reverses founder total_contributed/total_withdrawn. Restores inventory lots. Restore brings back everything with original dates. Founder balances restored idempotently.
  - **Delivery**: cascade-deletes client_inventory + company_inventory created by delivery, re-syncs order status. Restore re-creates inventory and re-syncs order status.
  - **Audit ↔ Collection**: Deleting audit with linked collection shows warning and cascade-deletes collection. Restoring audit restores linked collection from trash. Deleting collection reverts audit status to "Completed". Restoring collection sets audit status to "تم التحصيل".
  - **Supplier**: cascade-saves supplier_materials. Restore re-creates them.
  - **Founder**: cascade-deletes delivery_actor. Saves original actor snapshot. Restore re-creates exact actor.
  - **Treasury Transaction**: Delete reverses account balance. Restore re-applies balance.
  - **Founder Transaction**: Delete reverses founder totals. Restore re-applies totals idempotently.
  - **Treasury Account**: cascade-saves all transactions. Restore re-creates them.
  - **Company Inventory**: now soft-deleted with snapshot for trash restore.
  - **Activity.tsx restore**: prefers trash restore (with full cascade) over direct POST. Entity type normalization handles singular/plural mappings.
- **ConfirmDeleteDialog** (`src/components/ConfirmDeleteDialog.tsx`) — Reusable confirmation dialog before any delete
- **auditLog utility** (`src/lib/auditLog.ts`) — Logs create/update/delete operations to `notifications` table for activity tracking. All pages pass `performedBy: profile?.full_name` to track who performed each action.
- **Activity Page** (`src/pages/Activity.tsx`) — Displays audit history grouped by date. Supports `?highlight=<id>` query param to auto-scroll to and highlight a specific entry. Entity names are clickable links that navigate to the relevant page (order details, client profile, etc.).
- **NotificationBell** (`src/components/NotificationBell.tsx`) — Clicking a notification navigates to `/activity?highlight=<id>` to show full details before navigating to the entity.
- **Order Cascade Delete**: Deleting an order also deletes all related records. Full related data is saved in the trash snapshot.
- **Order Cascade Restore**: `POST /orders/:id/cascade-restore` re-creates the order and all related records from the saved snapshot.

## Client Analysis Page (`/clients/:id/analysis`)
Internal company page for analyzing client performance and consumption patterns. Features:
- **Client Score (0-100)**: Weighted composite of collection rate (35%), order regularity (25%), consumption volume (20%), return rate (20%). Displayed as circular gauge + radar chart.
- **Month-over-Month Comparison**: Current vs previous month for orders, order value, deliveries, collections, returns — with percentage change indicators.
- **Smart Alerts**: Overdue payments (>30 days), inactive client (>45 days no orders), high return rate (>15%), low consumption materials (<30%).
- **Consumption Predictions**: Per-material runout estimates based on remaining qty / weekly usage. Status badges: Critical (≤2 weeks), Soon (≤6 weeks), Stable.
- **Returns Analysis**: Return count, items, accepted/pending breakdown, return rate %.
- **Order Trend Charts**: Last 6 months bar chart (orders) + line chart (value).
- **Preferred Materials**: Pie chart of top 6 ordered materials by quantity.
- **Consumption Pattern Table**: Top 15 materials with delivered/consumed/remaining + progress bar.
- File: `src/pages/ClientAnalysis.tsx`. Fully bilingual (AR/EN) via `ca*` translation keys. Print-ready with fixed header/footer.
- Linked from ClientProfile via "تحليل العميل" / "Client Analysis" button.

## Client Report Enhancements
- **Comparison with Average**: New section comparing client's metrics (orders count, avg order value, collection rate) against all-clients average. Shows trend badges (above/below average) with percentage difference.
- **Date Filter**: Toggle filter (All / 3 months / 6 months / 1 year) in toolbar to scope report data by time period.
- **Save PDF Button**: Dedicated "Save PDF" button alongside Print and CSV export.

## Client Profile Enhancements
- **Last Order Date**: Stats card showing the date of the most recent order (or "No orders yet").

## Global Search (`src/components/GlobalSearch.tsx`)
- Search bar in the app header (also triggered with Ctrl+K).
- Searches across clients, orders, and materials with type badges.
- Click result to navigate directly to the entity page.

## Dashboard Enhancements (`src/pages/Dashboard.tsx`)
- **Today's Summary**: Cards showing today's new orders, due collections today, and low stock alerts.
- **Overdue Clients**: Top 5 clients with overdue payments ranked by amount. Clickable to navigate to client profile.
- **Monthly Snapshot**: Shows last month's metrics (revenue, profit, orders, new clients, collection rate) with a "Generate Snapshot" button to save to database.

## Client Comparison Page (`/client-comparison`)
- Select two clients and compare side by side across 8 metrics: total orders, revenue, avg order value, collection rate, outstanding, inventory value, last order, join date.
- Trophy icon highlights the better performer per metric.
- File: `src/pages/ClientComparison.tsx`. Accessible from sidebar under System group.

## Monthly Snapshots API
- `GET /api/monthly-snapshots` — List saved snapshots.
- `POST /api/monthly-snapshots` — Create/update a snapshot for a given month. Table auto-created if missing.

## Company Analysis Page (`/company-analysis`)
Company-wide business intelligence report accessible from the sidebar. Features:
- **Company Health Score (0-100)**: Weighted composite of profit margin (25%), collection rate (25%), growth (20%), return rate (15%), delivery rate (15%). SVG gauge + radar chart.
- **KPI Cards**: Total revenue, net profit with margin %, total orders, active clients (last 90 days), collection rate, total returns.
- **Treasury Overview**: Inflow, outflow, net cash flow cards.
- **Monthly Revenue & Profit Trend**: 12-month ComposedChart (revenue bars, cost bars, profit line).
- **Order Status Distribution**: Pie chart with color-coded statuses.
- **Client Segments**: Pie chart (High Value >50k, Medium 10-50k, Low <10k, New).
- **Top Clients Table**: Clickable rows → client profile. Shows orders, revenue, paid, balance.
- **At-Risk Clients**: Overdue (>30 days), inactive (>45 days), high returns (>15%). Red alert cards.
- **Top Materials by Revenue**: Horizontal bar chart.
- **Delivery Performance**: Confirmed vs pending with rate bar.
- **Collection Health**: Collected vs remaining + collection rate bar.
- **Aging Analysis**: Bar chart of outstanding by age bucket (0-30, 31-60, 61-90, 90+ days).
- **Period Comparison**: This month vs last month with % change arrows for revenue, profit, orders, collections.
- **Monthly Highlights**: Best month, worst month cards. Revenue forecast (linear regression on last 6 months). Client growth rate card.
- **Per-Client Profit Margin**: Profit margin column in Top Clients table with color-coded badges (green ≥30%, amber ≥15%, red <15%).
- **Client Growth Chart**: Bar chart showing new clients per month over last 12 months.
- **Inventory & Supply Predictions**: Top 20 items by runout urgency. Status badges.
- **Supplier Analysis**: Cost bar chart by supplier.
- **Returns by Client**: Bar chart of return items per client.
- **Monthly Activity Overview**: Combined chart (orders, deliveries, returns bars + collections line).
- File: `src/pages/CompanyAnalysis.tsx`. Fully bilingual (AR/EN) via `co*` translation keys. Print-ready. CSV export with 7 sections.
- Sidebar: Under "System" group with PieChart icon.

## Accounting Logic Fixes (Applied)
- **DELETE /treasury/transactions/all**: Deletes transactions first, then reverses account balances (safe ordering — if delete fails, no balance touched)
- **DELETE /treasury/transactions/:id**: Same safe ordering — delete first, then reverse balance
- **GET /founder-balances**: Handles multi-order collections via `notes.sourceOrders`, distributes paid amount proportionally across orders, uses per-order `companyProfitPercentage` instead of global percentage
- **GET /company-profit-summary**: Read-only endpoint — removed side-effect that was auto-updating `treasury_accounts` balance on every GET
- **POST /returns/:id/accept**: Return value deduction now distributes across ALL collections for the order (not just the most recent one)

## Data Sync Architecture
- **Company Account Balance ("حساب الشركة")**: Always computed live from `/company-profit-summary` (netProfit = totalCompanyProfit - totalExpenses). The DB `treasury_accounts.balance` is NOT used for display — all frontend pages (Treasury.tsx, TreasuryAccounts.tsx, CompanyProfit.tsx, FinancialReport.tsx) override the company account's displayed balance with the computed value.
- **Founder Balances**: Computed by server `/founder-balances` endpoint (source of truth). Pages that need quick access (FounderFunding, OrderDetails, TreasuryAccounts) call this API. Founders.tsx computes locally using the same `quickProfit`/`founderSplit` from `orderProfit.ts`.
- **Per-Order Profit Percentage**: All pages and server endpoints use per-order `companyProfitPercentage` from `founder_contributions[0].companyProfitPercentage`, falling back to global `rules.companyProfitPercentage`.

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

## Supplier Intelligence System
- **`supplier_ratings` table**: Created via pgPool (direct PostgreSQL), NOT through Supabase PostgREST (schema cache issue). All CRUD uses `pgPool` in `server/routes.ts`.
- **API Endpoints**:
  - `GET /api/material-supplier-history/:code` — Full supplier history per material (prices, dates, ratings)
  - `GET /api/material-best-suppliers` — Best supplier (lowest price) for all materials with all supplier comparisons
  - `GET /api/supplier-bundle-check?codes=a,b,c` — Single-supplier bundles for multiple materials
  - `GET /api/supplier-ratings` / `GET /api/supplier-ratings/:supplierId` — Rating records
  - `POST /api/supplier-ratings` — Create rating (quality/delivery/quantity 0-5, auto-computes overall)
  - `DELETE /api/supplier-ratings/:id` — Remove rating
  - `GET /api/supplier-ranking` — Ranked supplier list (score = avgRating*20 + priceBeatPercent + min(orders,10)*2)
- **Frontend**:
  - `OrderDetails.tsx`: Best supplier badge on line items, price comparison popup card (all suppliers with last/min/avg price, ↑↓ arrows, star ratings), auto-select best supplier button, bundle suggestion panel
  - `SupplierProfile.tsx`: "Ratings" tab with star-based rating form, avg rating display, history list with delete
  - `Suppliers.tsx`: "ترتيب الموردين" ranking view with gold/silver/bronze medals, orders/materials/purchases stats

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
- **Supplier Profile Page** (`src/pages/SupplierProfile.tsx`) — Route `/suppliers/:id`, shows full supplier details, stats, orders (supplier-specific cost/items), inventory lots, materials (with images + price history from order lines), and analytics (monthly purchase chart using supplier-specific cost). Materials auto-detected from order lines shown with "من الطلبات" badge. Each material card shows: image, latest price, price change indicator, and scrollable price history with order links. Includes edit dialog and delete with confirmation + audit logging.
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

## Dashboard
- Redesigned with clear visual hierarchy: Hero KPIs → Quick Stats → Charts → Data Tables → Alerts
- 4 main KPI cards with colored borders: Profit, Revenue, Collection Rate, Active Orders
- 6 quick stat mini-cards: Clients, Deliveries, Collections, Returns, Client Inventory, Company Inventory
- Charts: Financial monthly (ComposedChart), Order status pie, Delivery bars, Collection pie, Monthly collection trend, Company inventory material usage bars
- All sections expanded by default (no collapse toggles)
- Quick action buttons in header (new order, clients, reports)
- Action alerts strip at bottom (only shown when pending items exist)
- Collection rate KPI uses `totalCollected / allOrdersSelling` (same formula as Orders page)

## Notes
- API returns camelCase; Supabase stores snake_case. Helpers `camelizeKeys`/`snakifyKeys` handle conversion in routes.ts
- Seed runs only once when `clients` table is empty
- Founder transactions are stored in `treasury_transactions` with special txTypes (founder_contribution, founder_withdrawal, order_funding) to avoid needing a new table
- `src/data/store.ts` contains static fallback data; most pages now use live API data
