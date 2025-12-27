-- Drop the old constraint that limits duration to 24
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS duration_positive;

-- Add new constraint that allows larger duration for monthly bookings
-- Duration must be > 0 and <= 366 (max 1 year in days)
ALTER TABLE public.bookings ADD CONSTRAINT duration_positive CHECK (duration > 0 AND duration <= 366);