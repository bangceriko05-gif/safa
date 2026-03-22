
CREATE TABLE public.accounting_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  source_id uuid NOT NULL,
  source_type text NOT NULL, -- 'booking', 'income', 'expense'
  source_bid text NOT NULL,
  source_label text NOT NULL,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  source_date date NOT NULL,
  status text NOT NULL DEFAULT 'proses', -- 'proses', 'selesai', 'batal'
  converted_to text,
  cancel_reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, source_id, source_type)
);

ALTER TABLE public.accounting_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accounting transactions in their stores"
  ON public.accounting_transactions FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Admins can insert accounting transactions"
  ON public.accounting_transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

CREATE POLICY "Admins can update accounting transactions"
  ON public.accounting_transactions FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id));

CREATE POLICY "Admins can delete accounting transactions"
  ON public.accounting_transactions FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id));
