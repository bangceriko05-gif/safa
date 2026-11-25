ALTER TABLE public.store_features
  ADD COLUMN IF NOT EXISTS monthly_price numeric,
  ADD COLUMN IF NOT EXISTS subscription_end_date date;

UPDATE public.store_features
SET monthly_price = NULLIF(regexp_replace(activation_price, '[^0-9]', '', 'g'), '')::numeric
WHERE monthly_price IS NULL
  AND activation_price IS NOT NULL
  AND regexp_replace(activation_price, '[^0-9]', '', 'g') <> '';

UPDATE public.stores
SET subscription_price = 150000,
    updated_at = now()
WHERE subscription_price IS NULL OR subscription_price = 0;

CREATE TABLE public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  feature_key text NOT NULL DEFAULT 'pms',
  feature_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  period_start date,
  period_end date,
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'cancelled')),
  payment_method text,
  reference text,
  paid_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Outlet users can read subscription payments"
ON public.subscription_payments FOR SELECT TO authenticated
USING (public.has_store_access(auth.uid(), store_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can create subscription payments"
ON public.subscription_payments FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update subscription payments"
ON public.subscription_payments FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete subscription payments"
ON public.subscription_payments FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE INDEX subscription_payments_store_created_idx
ON public.subscription_payments (store_id, created_at DESC);