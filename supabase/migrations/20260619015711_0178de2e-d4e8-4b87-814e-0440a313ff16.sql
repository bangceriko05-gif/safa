CREATE INDEX IF NOT EXISTS idx_products_store_name ON public.products (store_id, name);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants (product_id);
CREATE INDEX IF NOT EXISTS idx_product_recipes_product_id ON public.product_recipes (product_id);
CREATE INDEX IF NOT EXISTS idx_product_unit_conversions_product_id_active ON public.product_unit_conversions (product_id, is_active);

CREATE INDEX IF NOT EXISTS idx_stock_in_store_status_date ON public.stock_in (store_id, status, date);
CREATE INDEX IF NOT EXISTS idx_stock_out_store_status_date ON public.stock_out (store_id, status, date);
CREATE INDEX IF NOT EXISTS idx_stock_opname_store_status_date ON public.stock_opname (store_id, status, date);
CREATE INDEX IF NOT EXISTS idx_bookings_store_status_date ON public.bookings (store_id, status, date);

CREATE INDEX IF NOT EXISTS idx_stock_in_items_stock_in_id_product_id ON public.stock_in_items (stock_in_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_out_items_stock_out_id_product_id ON public.stock_out_items (stock_out_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_opname_items_stock_opname_id_product_id ON public.stock_opname_items (stock_opname_id, product_id);
CREATE INDEX IF NOT EXISTS idx_booking_products_booking_id_product_id ON public.booking_products (booking_id, product_id);