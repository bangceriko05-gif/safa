-- Update RLS policies for user_roles to include owner and akuntan
DROP POLICY IF EXISTS "Admins and leaders can create user roles" ON public.user_roles;
CREATE POLICY "Admins and leaders can create user roles" ON public.user_roles
FOR INSERT WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role]));

DROP POLICY IF EXISTS "Admins and leaders can delete user roles" ON public.user_roles;
CREATE POLICY "Admins and leaders can delete user roles" ON public.user_roles
FOR DELETE USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role]));

DROP POLICY IF EXISTS "Only admins can update user roles" ON public.user_roles;
CREATE POLICY "Only admins can update user roles" ON public.user_roles
FOR UPDATE USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role, 'akuntan'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role, 'akuntan'::app_role]));

DROP POLICY IF EXISTS "Admins and leaders can view all roles" ON public.user_roles;
CREATE POLICY "Admins and leaders can view all roles" ON public.user_roles
FOR SELECT TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role]) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins and leaders can view all roles or users own" ON public.user_roles;

-- Update permissions table policies
DROP POLICY IF EXISTS "Only admins can manage permissions" ON public.permissions;
CREATE POLICY "Only admins can manage permissions" ON public.permissions
FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role, 'akuntan'::app_role]));

-- Update user_permissions policies
DROP POLICY IF EXISTS "Only admins can grant permissions" ON public.user_permissions;
CREATE POLICY "Only admins can grant permissions" ON public.user_permissions
FOR INSERT WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role, 'akuntan'::app_role]));

DROP POLICY IF EXISTS "Only admins can revoke permissions" ON public.user_permissions;
CREATE POLICY "Only admins can revoke permissions" ON public.user_permissions
FOR DELETE USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role, 'akuntan'::app_role]));

DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;
CREATE POLICY "Users can view their own permissions" ON public.user_permissions
FOR SELECT USING (auth.uid() = user_id OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role]));