
-- Chart of Accounts (Bagan Akun)
CREATE TABLE public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_id uuid REFERENCES public.chart_of_accounts(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, code)
);

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accounts in their stores" ON public.chart_of_accounts
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Admins can manage accounts" ON public.chart_of_accounts
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id));

-- Journal Entries (Jurnal Umum)
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  description text NOT NULL,
  reference_no text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view journal entries in their stores" ON public.journal_entries
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Admins can manage journal entries" ON public.journal_entries
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id));

-- Journal Entry Lines (Detail Jurnal)
CREATE TABLE public.journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id),
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view journal lines" ON public.journal_entry_lines
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_entry_lines.journal_entry_id AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), je.store_id))));

CREATE POLICY "Admins can manage journal lines" ON public.journal_entry_lines
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_entry_lines.journal_entry_id AND (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), je.store_id))));

-- Accounts Payable (Hutang)
CREATE TABLE public.accounts_payable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_name text NOT NULL,
  description text,
  amount numeric NOT NULL,
  due_date date,
  paid_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payables in their stores" ON public.accounts_payable
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Admins can manage payables" ON public.accounts_payable
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id));

-- Accounts Receivable (Piutang)
CREATE TABLE public.accounts_receivable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  description text,
  amount numeric NOT NULL,
  due_date date,
  received_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view receivables in their stores" ON public.accounts_receivable
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Admins can manage receivables" ON public.accounts_receivable
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id));

-- Assets (Aset)
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  purchase_date date,
  purchase_price numeric NOT NULL DEFAULT 0,
  current_value numeric NOT NULL DEFAULT 0,
  depreciation_rate numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disposed', 'sold')),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assets in their stores" ON public.assets
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Admins can manage assets" ON public.assets
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id));

-- Add reports.accounting sub-feature to existing stores
INSERT INTO public.store_features (store_id, feature_key, is_enabled)
SELECT s.id, 'reports.accounting', true
FROM public.stores s
ON CONFLICT (store_id, feature_key) DO NOTHING;

-- Update trigger to include reports.accounting
CREATE OR REPLACE FUNCTION public.auto_create_store_features()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.store_features (store_id, feature_key, is_enabled)
  VALUES
    (NEW.id, 'calendar', true),
    (NEW.id, 'transactions', true),
    (NEW.id, 'customers', true),
    (NEW.id, 'reports', true),
    (NEW.id, 'settings', true),
    (NEW.id, 'products_inventory', true),
    (NEW.id, 'activity_log', true),
    (NEW.id, 'user_management', true),
    (NEW.id, 'booking_requests', true),
    (NEW.id, 'deposit', true),
    (NEW.id, 'transactions.list_booking', true),
    (NEW.id, 'transactions.expenses', true),
    (NEW.id, 'transactions.incomes', true),
    (NEW.id, 'transactions.deposits', true),
    (NEW.id, 'reports.overview', true),
    (NEW.id, 'reports.sales', true),
    (NEW.id, 'reports.income_expense', true),
    (NEW.id, 'reports.purchase', true),
    (NEW.id, 'reports.employee', true),
    (NEW.id, 'reports.accounting', true),
    (NEW.id, 'settings.display', true),
    (NEW.id, 'settings.colors', true),
    (NEW.id, 'settings.notifications', true),
    (NEW.id, 'settings.print', true),
    (NEW.id, 'settings.rooms', true),
    (NEW.id, 'settings.outlet', true),
    (NEW.id, 'settings.ota', true),
    (NEW.id, 'products_inventory.rooms', true),
    (NEW.id, 'products_inventory.products', true),
    (NEW.id, 'products_inventory.categories', true);
  RETURN NEW;
END;
$$;
