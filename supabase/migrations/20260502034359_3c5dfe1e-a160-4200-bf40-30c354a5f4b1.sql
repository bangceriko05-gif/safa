ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_available_offline boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.products.is_available_offline IS 'If false, product is hidden from POS (offline channel)';