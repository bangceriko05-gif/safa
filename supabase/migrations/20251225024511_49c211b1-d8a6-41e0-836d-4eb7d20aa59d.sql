-- Drop the check constraint that limits room status values
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_status_check;

-- No constraint needed - room status can be flexible (Aktif, Kotor, etc.)