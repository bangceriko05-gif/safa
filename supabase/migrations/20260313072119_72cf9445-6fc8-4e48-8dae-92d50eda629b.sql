
CREATE TABLE public.investor_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  source_account TEXT NOT NULL,
  investor_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.investor_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage investor transfers"
  ON public.investor_transfers FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id));

CREATE POLICY "Users can view investor transfers in their stores"
  ON public.investor_transfers FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));
