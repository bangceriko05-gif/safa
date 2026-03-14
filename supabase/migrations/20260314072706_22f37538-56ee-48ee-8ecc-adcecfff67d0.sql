
-- Rename existing columns
ALTER TABLE public.chart_of_accounts RENAME COLUMN code TO account_code;
ALTER TABLE public.chart_of_accounts RENAME COLUMN name TO account_name;
ALTER TABLE public.chart_of_accounts RENAME COLUMN account_type TO classification;

-- Add new columns
ALTER TABLE public.chart_of_accounts ADD COLUMN opening_balance numeric NOT NULL DEFAULT 0;
ALTER TABLE public.chart_of_accounts ADD COLUMN opening_balance_date date;
ALTER TABLE public.chart_of_accounts ADD COLUMN is_cash_account boolean NOT NULL DEFAULT false;
ALTER TABLE public.chart_of_accounts ADD COLUMN created_by uuid NOT NULL DEFAULT auth.uid();

-- Add unique constraint
ALTER TABLE public.chart_of_accounts ADD CONSTRAINT chart_of_accounts_store_account_code_unique UNIQUE (store_id, account_code);

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Admins can manage accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Users can view accounts in their stores" ON public.chart_of_accounts;

-- Create new RLS policies
CREATE POLICY "Users can view accounts in their stores"
ON public.chart_of_accounts FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Users can insert accounts"
ON public.chart_of_accounts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

CREATE POLICY "Admins and leaders can update accounts"
ON public.chart_of_accounts FOR UPDATE TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role]) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

CREATE POLICY "Admins and leaders can delete accounts"
ON public.chart_of_accounts FOR DELETE TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role]) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));
