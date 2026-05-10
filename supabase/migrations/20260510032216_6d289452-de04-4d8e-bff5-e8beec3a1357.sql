
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS posted_by uuid,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS received_by uuid,
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Existing rows are not drafts
UPDATE public.purchases SET is_draft = false WHERE is_draft IS NULL OR created_at < now();
