ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS schedule_start_time text NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS schedule_end_time text NOT NULL DEFAULT '05:00',
  ADD COLUMN IF NOT EXISTS schedule_slot_minutes integer NOT NULL DEFAULT 60;