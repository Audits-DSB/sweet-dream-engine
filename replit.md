# DSB - Operations & Business Management App

## Overview
A full-featured React + TypeScript operations management dashboard ("DSB") for managing clients, orders, deliveries, inventory, collections, suppliers, treasury, founders, reports, and user management. Migrated from Lovable → Replit with PostgreSQL backend.

## Architecture
- **Frontend**: React 18 + TypeScript + Vite (proxied via Express on port 5000)
- **Backend**: Express.js + Drizzle ORM (port 5000)
- **Database**: Replit PostgreSQL — all business data (12 tables)
- **Auth**: Supabase — ONLY for authentication (email/password + OAuth). No Supabase data tables used.
- **UI**: Tailwind CSS + shadcn/ui + Radix UI components
- **Routing**: React Router v6
- **State**: TanStack React Query + React Context (AuthContext, WorkflowContext, LanguageContext)
- **Charts**: Recharts
- **Design**: RTL Arabic, IBM Plex Sans Arabic font, orange primary color theme

## Database Tables (PostgreSQL via Drizzle)
12 tables: `clients`, `suppliers`, `materials`, `founders`, `orders`, `requests`, `deliveries`, `collections`, `inventory`, `notifications`, `treasury_accounts`, `treasury_transactions`

## Key Files
- `server/index.ts` — Express entry point, seeds data, proxies Vite on 5001
- `server/routes.ts` — All CRUD API endpoints for all 12 tables
- `server/db.ts` — Drizzle DB connection
- `shared/schema.ts` — Full Drizzle schema for all tables
- `src/lib/api.ts` — Central frontend API client (fetch wrapper to /api/*)
- `src/contexts/WorkflowContext.tsx` — Main data context (loads all data from API)
- `src/data/store.ts` — Static seed data (used for initial DB seeding on first startup)
- `drizzle.config.ts` — Drizzle Kit config

## Key Structure
```
src/
  pages/          — All page-level components (30+ pages)
  components/     — Shared UI components (AppLayout, AppSidebar, etc.)
  contexts/       — Auth, Workflow, Language context providers
  integrations/
    supabase/     — Supabase client (ONLY used for auth calls)
  lib/
    api.ts        — Frontend API client for all backend calls
  data/           — Static seed data (store.ts)
  hooks/          — Custom React hooks
  i18n/           — Internationalization (Arabic/English RTL support)
server/
  index.ts        — Express server + seeding
  routes.ts       — All /api/* CRUD routes
  db.ts           — Drizzle DB connection
shared/
  schema.ts       — Drizzle schema (all 12 tables)
```

## Environment Variables (Replit Secrets)
- `VITE_SUPABASE_URL` — Supabase project URL (auth only)
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key (auth only)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- `DATABASE_URL` — Replit PostgreSQL connection string (auto-provided)

## Running the App
```bash
npx tsx server/index.ts   # starts Express on 5000, spawns Vite on 5001
```

## Migration Notes (Lovable → Replit)
- All business data moved from Supabase to Replit PostgreSQL
- Supabase kept ONLY for auth (`supabase.auth.*` calls)
- `UserManagement.tsx` reads `profiles`/`user_roles` from Supabase (auth tables - intentional)
- `Requests.tsx` uses `supabase.auth.getSession()` for calling external Supabase Edge Function (fetch-external-materials) — intentional
- All other pages use `src/lib/api.ts` for data operations
- Treasury data seeded directly via API (accounts and transactions)
- Field naming: API returns camelCase (Drizzle convention)
