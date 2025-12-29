-- Drop existing constraint and add new one with BATAL status
ALTER TABLE public.bookings DROP CONSTRAINT bookings_status_check;

ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check 
CHECK (status = ANY (ARRAY['BO'::text, 'CI'::text, 'CO'::text, 'BATAL'::text]));