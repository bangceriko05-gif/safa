
-- 1) Tighten identity-documents bucket policies (scope by store_id from path)
DROP POLICY IF EXISTS "Authenticated users can view identity documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload identity documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update identity documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete identity documents" ON storage.objects;

CREATE POLICY "Identity docs: view by store access"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'identity-documents'
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_store_access(
        auth.uid(),
        NULLIF((storage.foldername(name))[1], '')::uuid
      )
    )
  );

CREATE POLICY "Identity docs: upload by store access"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'identity-documents'
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_store_access(
        auth.uid(),
        NULLIF((storage.foldername(name))[1], '')::uuid
      )
    )
  );

CREATE POLICY "Identity docs: update by store access"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'identity-documents'
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_store_access(
        auth.uid(),
        NULLIF((storage.foldername(name))[1], '')::uuid
      )
    )
  );

CREATE POLICY "Identity docs: delete by store access"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'identity-documents'
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_store_access(
        auth.uid(),
        NULLIF((storage.foldername(name))[1], '')::uuid
      )
    )
  );

-- 2) Remove duplicate, unconditional anon INSERT on payment-proofs.
-- Keep the validated one ("Public upload to payment proofs with validation").
DROP POLICY IF EXISTS "Public can upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects;
