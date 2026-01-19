-- Add policy for store admins/leaders to view user_store_access for their stores
CREATE POLICY "store_admins_view_store_user_access" ON public.user_store_access
FOR SELECT
USING (
  -- Super admins can see all (already covered by super_admins_view_all_store_access)
  -- Store admins/leaders can see all access records for stores they have access to
  EXISTS (
    SELECT 1 FROM public.user_store_access usa
    WHERE usa.user_id = auth.uid()
    AND usa.store_id = user_store_access.store_id
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role])
  )
);