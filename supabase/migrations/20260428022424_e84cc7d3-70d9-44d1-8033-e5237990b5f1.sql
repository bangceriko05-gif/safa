ALTER TABLE public.room_categories
  ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_mode TEXT NOT NULL DEFAULT 'exclude' CHECK (tax_mode IN ('include','exclude'));