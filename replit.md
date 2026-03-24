# DSB - Operations & Business Management App

## Overview
A full-featured React + TypeScript operations management dashboard ("DSB") for managing clients, orders, deliveries, inventory, collections, suppliers, treasury, founders, reports, and user management.

## Architecture
- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Auth & Database**: Supabase (hosted) — handles authentication (email/password + OAuth) and all data storage via PostgreSQL
- **UI**: Tailwind CSS + shadcn/ui + Radix UI components
- **Routing**: React Router v6
- **State**: TanStack React Query + React Context (AuthContext, WorkflowContext, LanguageContext)
- **Charts**: Recharts

## Key Structure
```
src/
  pages/          — All page-level components (30+ pages)
  components/     — Shared UI components (AppLayout, AppSidebar, etc.)
  contexts/       — Auth, Workflow, Language context providers
  integrations/
    supabase/     — Supabase client + TypeScript types
    lovable/      — OAuth helper (now uses Supabase OAuth directly)
  data/           — Static seed data (store.ts)
  hooks/          — Custom React hooks
  i18n/           — Internationalization (Arabic/English RTL support)
```

## Environment Variables (Replit Secrets)
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key

## Running the App
```bash
npm run dev    # starts Vite dev server on port 5000
npm run build  # production build
```

## Migration Notes (Lovable → Replit)
- Removed `@lovable.dev/cloud-auth-js` and `lovable-tagger` packages
- Replaced Lovable OAuth wrapper with direct Supabase `signInWithOAuth`
- Updated `vite.config.ts`: host `0.0.0.0`, port `5000`, `allowedHosts: true`
- Moved Supabase keys from `.env` file to Replit Secrets
- Fixed CSS `@import` ordering (must precede `@tailwind` directives)
- Supabase handles all auth & data — no backend server needed
