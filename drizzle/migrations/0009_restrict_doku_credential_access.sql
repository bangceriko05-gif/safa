REVOKE ALL ON TABLE public.doku_outlet_credentials FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.doku_outlet_credentials TO service_role;
REVOKE SELECT, INSERT, UPDATE ON public.website_payment_settings FROM anon;
REVOKE SELECT(doku_secret_key), INSERT(doku_secret_key), UPDATE(doku_secret_key) ON public.website_payment_settings FROM anon, authenticated;
COMMENT ON COLUMN public.website_payment_settings.doku_secret_key IS 'DEPRECATED: replaced by service-only encrypted doku_outlet_credentials; never exposed to browsers';