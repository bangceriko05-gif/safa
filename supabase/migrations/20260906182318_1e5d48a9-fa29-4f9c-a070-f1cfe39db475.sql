ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS qr_logo_mode text NOT NULL DEFAULT 'anka';
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_qr_logo_mode_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_qr_logo_mode_check CHECK (qr_logo_mode IN ('anka','outlet','none'));