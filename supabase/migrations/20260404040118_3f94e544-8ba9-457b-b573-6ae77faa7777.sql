ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS receipt_url text,
ADD COLUMN IF NOT EXISTS reference_no text;