CREATE TABLE public.loyalty_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT true,
  earn_per_amount numeric NOT NULL DEFAULT 10000,
  points_per_earn numeric NOT NULL DEFAULT 1,
  points_per_visit numeric NOT NULL DEFAULT 0,
  redeem_point_value numeric NOT NULL DEFAULT 1000,
  min_redeem_points numeric NOT NULL DEFAULT 10,
  tier_silver_points numeric NOT NULL DEFAULT 100,
  tier_gold_points numeric NOT NULL DEFAULT 500,
  tier_platinum_points numeric NOT NULL DEFAULT 1000,
  expiry_months integer NOT NULL DEFAULT 12,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_settings TO authenticated;
GRANT ALL ON public.loyalty_settings TO service_role;
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_settings_select" ON public.loyalty_settings FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));
CREATE POLICY "loyalty_settings_insert" ON public.loyalty_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));
CREATE POLICY "loyalty_settings_update" ON public.loyalty_settings FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));
CREATE POLICY "loyalty_settings_delete" ON public.loyalty_settings FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_store_admin(auth.uid(), store_id));

CREATE TRIGGER update_loyalty_settings_updated_at BEFORE UPDATE ON public.loyalty_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  type text NOT NULL DEFAULT 'earn',
  points numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  reference_bid text,
  description text,
  expires_at date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_txn_store_customer ON public.loyalty_transactions (store_id, customer_id, created_at DESC);
CREATE INDEX idx_loyalty_txn_phone ON public.loyalty_transactions (store_id, customer_phone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_transactions TO authenticated;
GRANT ALL ON public.loyalty_transactions TO service_role;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_txn_select" ON public.loyalty_transactions FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));
CREATE POLICY "loyalty_txn_insert" ON public.loyalty_transactions FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));
CREATE POLICY "loyalty_txn_update" ON public.loyalty_transactions FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));
CREATE POLICY "loyalty_txn_delete" ON public.loyalty_transactions FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_store_admin(auth.uid(), store_id));

CREATE TRIGGER update_loyalty_transactions_updated_at BEFORE UPDATE ON public.loyalty_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();