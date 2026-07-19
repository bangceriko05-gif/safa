CREATE INDEX IF NOT EXISTS idx_activity_logs_store_created_nonnull
ON public.activity_logs (store_id, created_at DESC)
WHERE store_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_logs_global_created
ON public.activity_logs (created_at DESC)
WHERE store_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_income_products_income_product
ON public.income_products (income_id, product_id);

CREATE INDEX IF NOT EXISTS idx_booking_products_booking_subtotal
ON public.booking_products (booking_id, subtotal);

CREATE INDEX IF NOT EXISTS idx_room_daily_status_date_room_updated
ON public.room_daily_status (date, room_id, updated_by);

CREATE INDEX IF NOT EXISTS idx_room_daily_status_room_date_status
ON public.room_daily_status (room_id, date, status);

CREATE INDEX IF NOT EXISTS idx_user_store_access_user_store
ON public.user_store_access (user_id, store_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
ON public.user_roles (user_id, role);

CREATE INDEX IF NOT EXISTS idx_permissions_name
ON public.permissions (name);