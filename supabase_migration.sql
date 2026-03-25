-- ============================================================
-- DSB Migration: Move local pgPool tables to Supabase
-- Run this ONCE in your Supabase SQL Editor:
-- Dashboard → Database → SQL Editor → New Query → Paste → Run
-- ============================================================

-- order_lines: items per order
CREATE TABLE IF NOT EXISTS order_lines (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL,
  material_code TEXT,
  material_name TEXT,
  image_url TEXT,
  unit TEXT DEFAULT 'unit',
  quantity NUMERIC DEFAULT 1,
  selling_price NUMERIC DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  line_total NUMERIC DEFAULT 0,
  line_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- order_founder_contributions: who funded each order
CREATE TABLE IF NOT EXISTS order_founder_contributions (
  order_id TEXT PRIMARY KEY,
  contributions JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- client_inventory: per-client stock tracking
CREATE TABLE IF NOT EXISTS client_inventory (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  client_name TEXT,
  material TEXT,
  code TEXT,
  unit TEXT,
  delivered NUMERIC DEFAULT 0,
  remaining NUMERIC DEFAULT 0,
  selling_price NUMERIC DEFAULT 0,
  store_cost NUMERIC DEFAULT 0,
  delivery_date TEXT,
  expiry TEXT,
  source_order TEXT,
  status TEXT DEFAULT 'In Stock',
  avg_weekly_usage NUMERIC DEFAULT 0,
  lead_time_weeks NUMERIC DEFAULT 2,
  safety_stock NUMERIC DEFAULT 5,
  shortage_qty NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- delivery_actors: drivers and founders who do deliveries (TEXT id like ACT-F-xxx)
CREATE TABLE IF NOT EXISTS delivery_actors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'driver',
  phone TEXT,
  email TEXT,
  active BOOLEAN DEFAULT TRUE,
  founder_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- supplier_materials: which materials each supplier provides
CREATE TABLE IF NOT EXISTS supplier_materials (
  supplier_id TEXT NOT NULL,
  material_code TEXT NOT NULL,
  material_name TEXT,
  PRIMARY KEY (supplier_id, material_code)
);

-- audits: stock audit records (TEXT id like AUD-001)
CREATE TABLE IF NOT EXISTS audits (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  client_name TEXT,
  date TEXT,
  auditor TEXT,
  total_items INTEGER DEFAULT 0,
  matched INTEGER DEFAULT 0,
  shortage INTEGER DEFAULT 0,
  surplus INTEGER DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'open',
  comparison JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- business_rules: app-wide settings (single row with id='default')
CREATE TABLE IF NOT EXISTS business_rules (
  id TEXT PRIMARY KEY DEFAULT 'default',
  company_profit_percentage NUMERIC DEFAULT 40,
  default_split_mode TEXT DEFAULT 'equal',
  default_delivery_fee NUMERIC DEFAULT 30,
  subscription_type TEXT DEFAULT 'none',
  subscription_value NUMERIC DEFAULT 0,
  default_lead_time_weeks INTEGER DEFAULT 2,
  default_coverage_weeks INTEGER DEFAULT 4,
  default_safety_stock NUMERIC DEFAULT 5,
  low_stock_alert_enabled BOOLEAN DEFAULT TRUE,
  expiry_alert_days INTEGER DEFAULT 14,
  audit_reminder_enabled BOOLEAN DEFAULT TRUE,
  audit_reminder_days INTEGER DEFAULT 7,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS so the service role key can read/write freely
ALTER TABLE order_lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_founder_contributions DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_actors DISABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_materials DISABLE ROW LEVEL SECURITY;
ALTER TABLE audits DISABLE ROW LEVEL SECURITY;
ALTER TABLE business_rules DISABLE ROW LEVEL SECURITY;
