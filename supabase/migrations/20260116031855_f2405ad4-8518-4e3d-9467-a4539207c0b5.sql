-- Add calendar_type column to stores table
-- 'pms' = PMS Calendar (room rows, date columns - like SAFA Kost)
-- 'schedule' = Schedule Table (time rows, room columns - hourly booking)
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS calendar_type text DEFAULT 'schedule';

-- Update existing stores based on their name pattern
-- SAFA Kost should use 'pms' calendar type
UPDATE public.stores SET calendar_type = 'pms' WHERE LOWER(name) LIKE '%safa%';

-- Oak Hotel should also use 'pms' since it was duplicated from SAFA
UPDATE public.stores SET calendar_type = 'pms' WHERE LOWER(name) LIKE '%oak%hotel%';

-- Add comment for documentation
COMMENT ON COLUMN public.stores.calendar_type IS 'Calendar display type: pms (room rows, date columns) or schedule (time rows, room columns)';