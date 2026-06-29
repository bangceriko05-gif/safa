CREATE INDEX IF NOT EXISTS idx_customers_store_id_name ON public.customers (store_id, name);
CREATE INDEX IF NOT EXISTS idx_customers_store_id_phone ON public.customers (store_id, phone);