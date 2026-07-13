
CREATE TABLE IF NOT EXISTS public.pos_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE,
  require_payment_proof boolean NOT NULL DEFAULT true,
  require_customer boolean NOT NULL DEFAULT false,
  enable_print boolean NOT NULL DEFAULT true,
  service_charge_enabled boolean NOT NULL DEFAULT false,
  service_charge_type text NOT NULL DEFAULT 'percent',
  service_charge_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_settings TO authenticated;
GRANT ALL ON public.pos_settings TO service_role;

ALTER TABLE public.pos_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View pos settings for accessible stores"
ON public.pos_settings FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Manage pos settings for accessible stores"
ON public.pos_settings FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE TRIGGER update_pos_settings_updated_at
BEFORE UPDATE ON public.pos_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.booking_orders
  ADD COLUMN IF NOT EXISTS service_charge numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charge_type text,
  ADD COLUMN IF NOT EXISTS service_charge_value numeric;
