ALTER TABLE public.booking_order_items
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_mode text NOT NULL DEFAULT 'rp',
  ADD COLUMN IF NOT EXISTS discount_value numeric NOT NULL DEFAULT 0;