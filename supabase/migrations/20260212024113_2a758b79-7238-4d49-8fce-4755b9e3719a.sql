
-- Drop ALL existing policies on print_settings
DROP POLICY IF EXISTS "Admins and leaders can manage print settings" ON public.print_settings;
DROP POLICY IF EXISTS "Users with store access can view print settings" ON public.print_settings;

-- Create simple, clear policies for each operation
CREATE POLICY "print_settings_select"
ON public.print_settings
FOR SELECT
TO authenticated
USING (
  has_store_access(store_id, auth.uid()) OR is_super_admin(auth.uid())
);

CREATE POLICY "print_settings_insert"
ON public.print_settings
FOR INSERT
TO authenticated
WITH CHECK (
  is_store_admin(store_id, auth.uid()) OR is_super_admin(auth.uid())
);

CREATE POLICY "print_settings_update"
ON public.print_settings
FOR UPDATE
TO authenticated
USING (
  is_store_admin(store_id, auth.uid()) OR is_super_admin(auth.uid())
)
WITH CHECK (
  is_store_admin(store_id, auth.uid()) OR is_super_admin(auth.uid())
);

CREATE POLICY "print_settings_delete"
ON public.print_settings
FOR DELETE
TO authenticated
USING (
  is_store_admin(store_id, auth.uid()) OR is_super_admin(auth.uid())
);
