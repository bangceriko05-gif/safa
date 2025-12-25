-- Make app admins/leaders treated as store admins for stores they can access.
-- This allows room status updates (e.g., set to 'Kotor' on checkout, and 'Ready' after cleaning) to succeed.

CREATE OR REPLACE FUNCTION public.is_store_admin(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    -- global super admin always admin
    public.is_super_admin(_user_id)
    OR (
      -- app role admin/leader for this store
      public.has_any_role(_user_id, ARRAY['admin'::public.app_role, 'leader'::public.app_role])
      AND public.has_store_access(_user_id, _store_id)
    )
    OR EXISTS (
      -- explicit store admin assignment
      SELECT 1
      FROM public.user_store_access
      WHERE user_id = _user_id
        AND store_id = _store_id
        AND role IN ('super_admin', 'admin')
    );
$function$;
