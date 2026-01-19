-- Drop the problematic policy
DROP POLICY IF EXISTS "store_admins_view_store_user_access" ON public.user_store_access;

-- Create a security definer function to check if user has admin access to a store
CREATE OR REPLACE FUNCTION public.user_has_store_admin_access(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_store_access
    WHERE user_id = _user_id
    AND store_id = _store_id
  ) AND has_any_role(_user_id, ARRAY['admin'::app_role, 'leader'::app_role])
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "store_admins_view_store_user_access" ON public.user_store_access
FOR SELECT TO authenticated
USING (
  public.user_has_store_admin_access(auth.uid(), store_id)
);