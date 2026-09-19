CREATE TABLE public.website_payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE,
  doku_enabled boolean NOT NULL DEFAULT false,
  doku_environment text NOT NULL DEFAULT 'sandbox',
  doku_client_id text,
  doku_secret_key text,
  doku_channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  manual_transfer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_payment_settings TO authenticated;
GRANT ALL ON public.website_payment_settings TO service_role;

ALTER TABLE public.website_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store users can view website payment settings"
ON public.website_payment_settings FOR SELECT TO authenticated
USING (public.has_store_access(auth.uid(), store_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Store admins can insert website payment settings"
ON public.website_payment_settings FOR INSERT TO authenticated
WITH CHECK (public.user_has_store_admin_access(auth.uid(), store_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Store admins can update website payment settings"
ON public.website_payment_settings FOR UPDATE TO authenticated
USING (public.user_has_store_admin_access(auth.uid(), store_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Store admins can delete website payment settings"
ON public.website_payment_settings FOR DELETE TO authenticated
USING (public.user_has_store_admin_access(auth.uid(), store_id) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_website_payment_settings_updated_at
BEFORE UPDATE ON public.website_payment_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();