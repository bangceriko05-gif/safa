ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_modes_allowed TEXT[] NOT NULL DEFAULT ARRAY['include','exclude']::TEXT[];