DROP POLICY IF EXISTS "Users can view own profile or admins view all" ON public.profiles;
DROP POLICY IF EXISTS "Admins and leaders can update all profiles or users own" ON public.profiles;
DROP POLICY IF EXISTS "Admins and leaders can delete profiles" ON public.profiles;

CREATE POLICY "Users can view own profile or privileged roles view all"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role])
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Privileged roles or self can update profiles"
  ON public.profiles
  FOR UPDATE
  USING (
    auth.uid() = id
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role])
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Privileged roles can delete profiles"
  ON public.profiles
  FOR DELETE
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role])
    OR is_super_admin(auth.uid())
  );