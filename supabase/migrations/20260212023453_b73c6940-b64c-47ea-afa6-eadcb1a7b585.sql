
-- Drop the existing ALL policy that's missing WITH CHECK
DROP POLICY IF EXISTS "Admins and leaders can manage print settings" ON public.print_settings;

-- Recreate with proper WITH CHECK clause
CREATE POLICY "Admins and leaders can manage print settings"
ON public.print_settings
FOR ALL
USING (
  is_store_admin(store_id, auth.uid()) 
  OR is_super_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM user_store_access usa
    WHERE usa.user_id = auth.uid() AND usa.store_id = print_settings.store_id AND usa.role = 'leader'
  )
)
WITH CHECK (
  is_store_admin(store_id, auth.uid()) 
  OR is_super_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM user_store_access usa
    WHERE usa.user_id = auth.uid() AND usa.store_id = print_settings.store_id AND usa.role = 'leader'
  )
);
