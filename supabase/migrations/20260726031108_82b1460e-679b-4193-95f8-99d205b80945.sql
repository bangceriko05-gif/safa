ALTER TABLE public.booking_orders ADD COLUMN IF NOT EXISTS process_status TEXT NOT NULL DEFAULT 'proses';
UPDATE public.booking_orders SET process_status = CASE WHEN payment_status = 'lunas' THEN 'selesai' ELSE 'proses' END WHERE process_status = 'proses';
CREATE INDEX IF NOT EXISTS idx_booking_orders_process_status ON public.booking_orders(process_status);