ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Indonesia',
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postal_code text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-photos', 'supplier-photos', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Supplier photos are publicly accessible' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Supplier photos are publicly accessible"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'supplier-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload supplier photos' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Authenticated users can upload supplier photos"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'supplier-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can update supplier photos' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Authenticated users can update supplier photos"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'supplier-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete supplier photos' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Authenticated users can delete supplier photos"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'supplier-photos');
  END IF;
END $$;