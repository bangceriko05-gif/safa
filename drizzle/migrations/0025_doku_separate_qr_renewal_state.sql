ALTER TABLE public.doku_payment_attempts ADD COLUMN superseded_at timestamptz;
ALTER TABLE public.doku_booking_attempts ADD COLUMN superseded_at timestamptz;
DROP INDEX public.doku_one_pending_order;
DROP INDEX public.doku_one_pending_booking;
CREATE UNIQUE INDEX doku_one_pending_order ON public.doku_payment_attempts(order_id) WHERE status='pending' AND superseded_at IS NULL;
CREATE UNIQUE INDEX doku_one_pending_booking ON public.doku_booking_attempts(booking_id) WHERE status='pending' AND superseded_at IS NULL;