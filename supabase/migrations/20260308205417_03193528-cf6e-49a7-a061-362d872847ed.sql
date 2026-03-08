-- Performance indexes for frequently queried columns

-- Bookings: queried by store_id, date, status, room_id
CREATE INDEX IF NOT EXISTS idx_bookings_store_date ON public.bookings (store_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_store_status ON public.bookings (store_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_room_date ON public.bookings (room_id, date);

-- Booking requests: queried by store_id, status
CREATE INDEX IF NOT EXISTS idx_booking_requests_store_status ON public.booking_requests (store_id, status);

-- Rooms: queried by store_id, status
CREATE INDEX IF NOT EXISTS idx_rooms_store_id ON public.rooms (store_id);

-- Room variants: queried by room_id, is_active
CREATE INDEX IF NOT EXISTS idx_room_variants_room_active ON public.room_variants (room_id, is_active);

-- Expenses: queried by store_id, date
CREATE INDEX IF NOT EXISTS idx_expenses_store_date ON public.expenses (store_id, date);

-- Incomes: queried by store_id, date
CREATE INDEX IF NOT EXISTS idx_incomes_store_date ON public.incomes (store_id, date);

-- Customers: queried by store_id, phone
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON public.customers (store_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone);

-- Activity logs: queried by store_id, created_at
CREATE INDEX IF NOT EXISTS idx_activity_logs_store_created ON public.activity_logs (store_id, created_at DESC);

-- User store access: queried by user_id, store_id
CREATE INDEX IF NOT EXISTS idx_user_store_access_user ON public.user_store_access (user_id);
CREATE INDEX IF NOT EXISTS idx_user_store_access_store ON public.user_store_access (store_id);

-- User roles: queried by user_id
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles (user_id);

-- Room deposits: queried by store_id, status
CREATE INDEX IF NOT EXISTS idx_room_deposits_store_status ON public.room_deposits (store_id, status);

-- Room daily status: queried by room_id, date
CREATE INDEX IF NOT EXISTS idx_room_daily_status_room_date ON public.room_daily_status (room_id, date);

-- Store features: queried by store_id
CREATE INDEX IF NOT EXISTS idx_store_features_store ON public.store_features (store_id);