-- Drop the existing policy
DROP POLICY IF EXISTS "Admins and leaders can modify rooms in their stores" ON public.rooms;

-- Recreate with simplified check (matching room_variants policy)
CREATE POLICY "Admins and leaders can modify rooms in their stores" 
ON public.rooms 
FOR ALL 
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role]) 
  AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id))
)
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role]) 
  AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id))
);