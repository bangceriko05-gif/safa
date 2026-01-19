-- Drop and recreate the stores SELECT policy with correct role
DROP POLICY IF EXISTS "Users can view stores they have access to" ON public.stores;

CREATE POLICY "Users can view stores they have access to" ON public.stores
FOR SELECT TO authenticated
USING (
  is_active = true 
  AND (
    is_super_admin(auth.uid()) 
    OR EXISTS (
      SELECT 1 FROM user_store_access usa 
      WHERE usa.user_id = auth.uid() 
      AND usa.store_id = stores.id
    )
  )
);