ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_phone_key;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_store_id_phone_key UNIQUE (store_id, phone);

COMMENT ON CONSTRAINT customers_store_id_phone_key ON public.customers IS
  'Customer phone numbers are unique within each outlet, not globally across outlets.';