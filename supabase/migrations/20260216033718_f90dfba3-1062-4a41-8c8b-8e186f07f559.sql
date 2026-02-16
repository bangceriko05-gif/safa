
-- Fix swapped arguments in print_settings RLS policies
DROP POLICY IF EXISTS "print_settings_select" ON public.print_settings;
DROP POLICY IF EXISTS "print_settings_insert" ON public.print_settings;
DROP POLICY IF EXISTS "print_settings_update" ON public.print_settings;
DROP POLICY IF EXISTS "print_settings_delete" ON public.print_settings;

CREATE POLICY "print_settings_select" ON public.print_settings
  FOR SELECT USING (has_store_access(auth.uid(), store_id) OR is_super_admin(auth.uid()));

CREATE POLICY "print_settings_insert" ON public.print_settings
  FOR INSERT WITH CHECK (is_store_admin(auth.uid(), store_id) OR is_super_admin(auth.uid()));

CREATE POLICY "print_settings_update" ON public.print_settings
  FOR UPDATE USING (is_store_admin(auth.uid(), store_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_store_admin(auth.uid(), store_id) OR is_super_admin(auth.uid()));

CREATE POLICY "print_settings_delete" ON public.print_settings
  FOR DELETE USING (is_store_admin(auth.uid(), store_id) OR is_super_admin(auth.uid()));
