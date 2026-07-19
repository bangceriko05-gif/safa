
CREATE INDEX IF NOT EXISTS idx_incomes_store_date ON public.incomes (store_id, date);
CREATE INDEX IF NOT EXISTS idx_income_products_income_id ON public.income_products (income_id);
CREATE INDEX IF NOT EXISTS idx_customers_store_name ON public.customers (store_id, name);
CREATE INDEX IF NOT EXISTS idx_room_variants_store_active ON public.room_variants (store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_store_name ON public.products (store_id, name);
CREATE INDEX IF NOT EXISTS idx_room_daily_status_date ON public.room_daily_status (date);
CREATE INDEX IF NOT EXISTS idx_expenses_store_date ON public.expenses (store_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_store_date ON public.bookings (store_id, date);
CREATE INDEX IF NOT EXISTS idx_booking_orders_store_date ON public.booking_orders (store_id, date);
CREATE INDEX IF NOT EXISTS idx_booking_order_items_order ON public.booking_order_items (booking_order_id);
CREATE INDEX IF NOT EXISTS idx_accounting_tx_store_date ON public.accounting_transactions (store_id, source_date);
CREATE INDEX IF NOT EXISTS idx_stock_in_store_date ON public.stock_in (store_id, date);
CREATE INDEX IF NOT EXISTS idx_stock_out_store_date ON public.stock_out (store_id, date);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants (product_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_store_created ON public.activity_logs (store_id, created_at DESC);
