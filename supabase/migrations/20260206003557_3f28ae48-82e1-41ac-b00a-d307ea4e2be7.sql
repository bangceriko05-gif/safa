-- Add payment_status column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN payment_status text NOT NULL DEFAULT 'belum_lunas';

-- Add comment for clarity
COMMENT ON COLUMN public.bookings.payment_status IS 'Status pembayaran: lunas or belum_lunas';