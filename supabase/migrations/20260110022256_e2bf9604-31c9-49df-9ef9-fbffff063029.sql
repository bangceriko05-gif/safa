-- Add payment_proof_url column to bookings table
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;