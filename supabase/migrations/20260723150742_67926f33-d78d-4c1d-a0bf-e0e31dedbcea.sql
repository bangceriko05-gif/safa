ALTER TABLE public.booking_orders
  ADD COLUMN IF NOT EXISTS shipping_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rounding numeric NOT NULL DEFAULT 0;