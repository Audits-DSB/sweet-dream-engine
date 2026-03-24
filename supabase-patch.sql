-- ════════════════════════════════════════════════════════════════
-- DSB Supabase Patch — Add missing columns to existing tables
-- Run this in Supabase SQL Editor → New Query → Run
-- ════════════════════════════════════════════════════════════════

-- ─── clients: add missing columns ────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS join_date   text DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_orders integer DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_audit  text DEFAULT '—';

-- ─── orders: add missing client name column ───────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client text NOT NULL DEFAULT '';

-- ─── Refresh PostgREST schema cache (important!) ─────────────────
NOTIFY pgrst, 'reload schema';
