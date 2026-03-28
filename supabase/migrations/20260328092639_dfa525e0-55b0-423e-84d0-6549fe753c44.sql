
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'Unverified';
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'tunda';
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS payment_proof_url text;
