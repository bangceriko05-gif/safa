-- Add visibility and booking duration settings to room_variants
ALTER TABLE public.room_variants 
ADD COLUMN IF NOT EXISTS visibility_type text DEFAULT 'all',
ADD COLUMN IF NOT EXISTS visible_days integer[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS booking_duration_type text DEFAULT 'hours',
ADD COLUMN IF NOT EXISTS booking_duration_value integer DEFAULT 1;

-- Add comment for clarity
COMMENT ON COLUMN public.room_variants.visibility_type IS 'all, weekdays, weekends, specific_days';
COMMENT ON COLUMN public.room_variants.visible_days IS 'Array of day numbers (0=Sunday, 1=Monday, etc)';
COMMENT ON COLUMN public.room_variants.booking_duration_type IS 'hours, days, weeks, months';
COMMENT ON COLUMN public.room_variants.booking_duration_value IS 'Number of duration units';