-- Drop the existing SELECT policy on stores
DROP POLICY IF EXISTS "Users can view stores they have access to" ON public.stores;

-- Create new policy that allows users to see all stores they have access to (active or inactive)
-- This is needed so users can see the "payment due" message for inactive stores
CREATE POLICY "Users can view stores they have access to"
ON public.stores
FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM user_store_access usa
    WHERE usa.user_id = auth.uid() AND usa.store_id = stores.id
  )
);