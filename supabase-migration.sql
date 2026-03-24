-- =====================================================
-- DSB App - Supabase Migration Script
-- Run this ONCE in: Supabase Dashboard > SQL Editor
-- =====================================================

-- ─── AUTH TABLES (required for user roles) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'founder', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'viewer',
  UNIQUE (user_id, role)
);

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── BUSINESS DATA TABLES ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  contact text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  city text DEFAULT '',
  status text DEFAULT 'Active',
  join_date text DEFAULT '',
  total_orders integer DEFAULT 0,
  outstanding text DEFAULT '0',
  last_audit text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  country text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  website text DEFAULT '',
  payment_terms text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS materials (
  code text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  category text DEFAULT '',
  unit text DEFAULT '',
  selling_price text DEFAULT '0',
  store_cost text DEFAULT '0',
  supplier text DEFAULT '',
  supplier_id text DEFAULT '',
  manufacturer text DEFAULT '',
  has_expiry boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS founders (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  alias text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  client text NOT NULL DEFAULT '',
  client_id text DEFAULT '',
  date text DEFAULT '',
  lines integer DEFAULT 0,
  total_selling text DEFAULT '0',
  total_cost text DEFAULT '0',
  split_mode text DEFAULT '',
  delivery_fee text DEFAULT '0',
  status text DEFAULT 'Pending',
  source text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS requests (
  id text PRIMARY KEY,
  client text NOT NULL DEFAULT '',
  client_id text DEFAULT '',
  date text DEFAULT '',
  items jsonb DEFAULT '[]',
  total_value text DEFAULT '0',
  priority text DEFAULT 'Normal',
  status text DEFAULT 'Client Requested',
  converted_order_id text,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deliveries (
  id text PRIMARY KEY,
  order_id text DEFAULT '',
  client text NOT NULL DEFAULT '',
  client_id text DEFAULT '',
  date text DEFAULT '',
  scheduled_date text DEFAULT '',
  status text DEFAULT 'Pending',
  delivered_by text DEFAULT '',
  delivery_fee text DEFAULT '0',
  items integer DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collections (
  id text PRIMARY KEY,
  order_id text DEFAULT '',
  client text NOT NULL DEFAULT '',
  client_id text DEFAULT '',
  invoice_date text DEFAULT '',
  due_date text DEFAULT '',
  total_amount text DEFAULT '0',
  paid_amount text DEFAULT '0',
  outstanding text DEFAULT '0',
  status text DEFAULT 'Unpaid',
  payment_method text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory (
  material_code text PRIMARY KEY,
  material_name text NOT NULL DEFAULT '',
  category text DEFAULT '',
  total_stock integer DEFAULT 0,
  reorder_point integer DEFAULT 0,
  lots jsonb DEFAULT '[]',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  type text DEFAULT 'info',
  title text NOT NULL DEFAULT '',
  message text DEFAULT '',
  date text DEFAULT '',
  time text DEFAULT '',
  read boolean DEFAULT false,
  user_id text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS treasury_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  account_type text DEFAULT 'cashbox',
  custodian_name text DEFAULT '',
  custodian_user_id text,
  bank_name text,
  account_number text,
  description text,
  balance numeric(14,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS treasury_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES treasury_accounts(id) ON DELETE CASCADE,
  tx_type text NOT NULL DEFAULT 'inflow',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  balance_after numeric(14,2) DEFAULT 0,
  category text,
  description text,
  reference_id text,
  linked_account_id uuid,
  performed_by text,
  approved_by text,
  date text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- ─── MAKE drseifelshamy@gmail.com AN ADMIN ───────────────────────────────────
-- This inserts the profile and admin role for the user

INSERT INTO public.profiles (user_id, full_name)
SELECT id, email FROM auth.users WHERE email = 'drseifelshamy@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'drseifelshamy@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
