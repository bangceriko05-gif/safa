
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS discount_all NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rounding_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rounding_mode TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_proof_files JSONB NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO storage.buckets (id, name, public)
VALUES ('purchase-files', 'purchase-files', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read purchase-files' AND tablename = 'objects') THEN
    CREATE POLICY "Public read purchase-files" ON storage.objects
      FOR SELECT USING (bucket_id = 'purchase-files');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated upload purchase-files' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated upload purchase-files" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'purchase-files');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated update purchase-files' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated update purchase-files" ON storage.objects
      FOR UPDATE TO authenticated USING (bucket_id = 'purchase-files');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated delete purchase-files' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated delete purchase-files" ON storage.objects
      FOR DELETE TO authenticated USING (bucket_id = 'purchase-files');
  END IF;
END $$;
