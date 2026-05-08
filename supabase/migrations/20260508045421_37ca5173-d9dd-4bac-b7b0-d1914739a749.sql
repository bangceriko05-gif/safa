
-- Tighten profiles policies to authenticated role (deny anon)
DROP POLICY IF EXISTS "Users can view own profile or privileged roles view all" ON public.profiles;
CREATE POLICY "Users can view own profile or privileged roles view all"
ON public.profiles FOR SELECT TO authenticated
USING ((auth.uid() = id) OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role]) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Privileged roles or self can update profiles" ON public.profiles;
CREATE POLICY "Privileged roles or self can update profiles"
ON public.profiles FOR UPDATE TO authenticated
USING ((auth.uid() = id) OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role]) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Privileged roles can delete profiles" ON public.profiles;
CREATE POLICY "Privileged roles can delete profiles"
ON public.profiles FOR DELETE TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role]) OR is_super_admin(auth.uid()));

-- Explicit deny for anonymous on profiles (defense in depth)
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles FOR SELECT TO anon
USING (false);

-- Tighten user_temp_passwords: explicit deny for non-admin authenticated and anon
CREATE POLICY "Deny anonymous access to temp passwords"
ON public.user_temp_passwords FOR SELECT TO anon
USING (false);
