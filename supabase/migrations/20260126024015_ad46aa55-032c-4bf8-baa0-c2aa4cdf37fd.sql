-- Drop existing SELECT policy for stores
DROP POLICY IF EXISTS "Users can view stores they have access to" ON public.stores;

-- Create new SELECT policy that allows super admins to view ALL stores (including inactive)
-- And regular users to view only active stores they have access to
CREATE POLICY "Users can view stores they have access to" 
ON public.stores 
FOR SELECT 
USING (
  is_super_admin(auth.uid()) 
  OR 
  ((is_active = true) AND EXISTS (
    SELECT 1 FROM user_store_access usa
    WHERE usa.user_id = auth.uid() AND usa.store_id = stores.id
  ))
);