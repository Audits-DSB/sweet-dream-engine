
-- Treasury account types
CREATE TYPE public.treasury_account_type AS ENUM ('cashbox', 'bank', 'wallet', 'founder_held', 'other');

-- Treasury transaction types
CREATE TYPE public.treasury_tx_type AS ENUM ('inflow', 'withdrawal', 'expense', 'transfer_in', 'transfer_out', 'adjustment');

-- Expense categories
CREATE TYPE public.treasury_expense_category AS ENUM ('marketing', 'operations', 'salaries', 'supplies', 'rent', 'utilities', 'logistics', 'maintenance', 'other');

-- Treasury accounts: where company money is held
CREATE TABLE public.treasury_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  account_type treasury_account_type NOT NULL DEFAULT 'cashbox',
  custodian_name TEXT NOT NULL,
  custodian_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  bank_name TEXT,
  account_number TEXT,
  description TEXT,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Treasury transactions: full movement log
CREATE TABLE public.treasury_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.treasury_accounts(id) ON DELETE CASCADE,
  tx_type treasury_tx_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  balance_after NUMERIC(14,2) NOT NULL DEFAULT 0,
  category treasury_expense_category,
  description TEXT,
  reference_id TEXT,
  linked_account_id UUID REFERENCES public.treasury_accounts(id) ON DELETE SET NULL,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_treasury_tx_account ON public.treasury_transactions(account_id);
CREATE INDEX idx_treasury_tx_type ON public.treasury_transactions(tx_type);
CREATE INDEX idx_treasury_tx_created ON public.treasury_transactions(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_treasury_accounts_updated_at
  BEFORE UPDATE ON public.treasury_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.treasury_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_transactions ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can view
CREATE POLICY "Authenticated users can view treasury accounts" ON public.treasury_accounts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view treasury transactions" ON public.treasury_transactions
  FOR SELECT TO authenticated USING (true);

-- RLS: admin and founder can manage
CREATE POLICY "Admins and founders can manage treasury accounts" ON public.treasury_accounts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'founder'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'founder'));

CREATE POLICY "Admins and founders can manage treasury transactions" ON public.treasury_transactions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'founder'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'founder'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.treasury_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.treasury_transactions;
