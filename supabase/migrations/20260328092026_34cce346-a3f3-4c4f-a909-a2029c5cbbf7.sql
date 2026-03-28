
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'Unverified';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'tunda';
