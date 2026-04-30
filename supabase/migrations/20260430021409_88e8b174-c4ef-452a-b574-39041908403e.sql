DROP POLICY IF EXISTS "Admins and leaders can modify rooms in their stores" ON public.rooms;

CREATE POLICY "Admins, leaders, owners, akuntan can modify rooms in their stores"
ON public.rooms
FOR ALL
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role])
  AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id))
)
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role])
  AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id))
);