-- Update remaining RLS policies that reference has_any_role with admin/leader
-- activity_logs
DROP POLICY IF EXISTS "Admins and leaders can view activity logs in their stores" ON public.activity_logs;
CREATE POLICY "Admins and leaders can view activity logs in their stores" ON public.activity_logs
FOR SELECT USING (is_super_admin(auth.uid()) OR (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role]) AND has_store_access(auth.uid(), store_id)));

-- accounting_activity_logs
DROP POLICY IF EXISTS "Admins and leaders can view accounting logs" ON public.accounting_activity_logs;
CREATE POLICY "Admins and leaders can view accounting logs" ON public.accounting_activity_logs
FOR SELECT TO authenticated USING (is_super_admin(auth.uid()) OR (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role]) AND has_store_access(auth.uid(), store_id)));

-- room_categories
DROP POLICY IF EXISTS "Admins and leaders can manage categories" ON public.room_categories;
CREATE POLICY "Admins and leaders can manage categories" ON public.room_categories
FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role]) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

-- ota_sources
DROP POLICY IF EXISTS "Admins and leaders can manage OTA sources" ON public.ota_sources;
CREATE POLICY "Admins and leaders can manage OTA sources" ON public.ota_sources
FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role]) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

-- payment_methods
DROP POLICY IF EXISTS "Admins and leaders can manage payment methods" ON public.payment_methods;
CREATE POLICY "Admins and leaders can manage payment methods" ON public.payment_methods
FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role]) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

-- room_variants
DROP POLICY IF EXISTS "Admins and leaders can manage room variants in their stores" ON public.room_variants;
CREATE POLICY "Admins and leaders can manage room variants in their stores" ON public.room_variants
FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role]) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

-- status_colors
DROP POLICY IF EXISTS "Only admins and leaders can modify status colors" ON public.status_colors;
CREATE POLICY "Only admins and leaders can modify status colors" ON public.status_colors
FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role]));

-- expenses delete/update
DROP POLICY IF EXISTS "Admins and leaders can delete expenses in their stores" ON public.expenses;
CREATE POLICY "Admins and leaders can delete expenses in their stores" ON public.expenses
FOR DELETE TO authenticated USING (((auth.uid() = created_by) OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role])) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

DROP POLICY IF EXISTS "Admins and leaders can update expenses in their stores" ON public.expenses;
CREATE POLICY "Admins and leaders can update expenses in their stores" ON public.expenses
FOR UPDATE TO authenticated USING (((auth.uid() = created_by) OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role])) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

-- incomes delete/update
DROP POLICY IF EXISTS "Admins and leaders can delete incomes in their stores" ON public.incomes;
CREATE POLICY "Admins and leaders can delete incomes in their stores" ON public.incomes
FOR DELETE TO authenticated USING (((auth.uid() = created_by) OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role])) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

DROP POLICY IF EXISTS "Admins and leaders can update incomes in their stores" ON public.incomes;
CREATE POLICY "Admins and leaders can update incomes in their stores" ON public.incomes
FOR UPDATE TO authenticated USING (((auth.uid() = created_by) OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role])) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

-- chart_of_accounts
DROP POLICY IF EXISTS "Admins and leaders can delete accounts" ON public.chart_of_accounts;
CREATE POLICY "Admins and leaders can delete accounts" ON public.chart_of_accounts
FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role]) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

DROP POLICY IF EXISTS "Admins and leaders can update accounts" ON public.chart_of_accounts;
CREATE POLICY "Admins and leaders can update accounts" ON public.chart_of_accounts
FOR UPDATE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role]) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

-- demo_requests
DROP POLICY IF EXISTS "Admins can delete demo requests" ON public.demo_requests;
CREATE POLICY "Admins can delete demo requests" ON public.demo_requests
FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role, 'akuntan'::app_role]));

DROP POLICY IF EXISTS "Admins can read demo requests" ON public.demo_requests;
CREATE POLICY "Admins can read demo requests" ON public.demo_requests
FOR SELECT TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role, 'akuntan'::app_role]));