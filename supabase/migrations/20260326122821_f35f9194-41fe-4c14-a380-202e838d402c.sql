-- Update is_store_admin to recognize owner and akuntan as admin-equivalent
CREATE OR REPLACE FUNCTION public.is_store_admin(_user_id uuid, _store_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.is_super_admin(_user_id)
    OR (
      public.has_any_role(_user_id, ARRAY['admin'::public.app_role, 'leader'::public.app_role, 'owner'::public.app_role, 'akuntan'::public.app_role])
      AND public.has_store_access(_user_id, _store_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_store_access
      WHERE user_id = _user_id
        AND store_id = _store_id
        AND role IN ('super_admin', 'admin')
    );
$function$;

-- Update user_has_store_admin_access to include owner and akuntan
CREATE OR REPLACE FUNCTION public.user_has_store_admin_access(_user_id uuid, _store_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_store_access
    WHERE user_id = _user_id
    AND store_id = _store_id
  ) AND has_any_role(_user_id, ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role])
$function$;

-- Update auto_assign_role_permissions to handle new roles
CREATE OR REPLACE FUNCTION public.auto_assign_role_permissions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_permissions (user_id, permission_id, granted_by)
  SELECT 
    NEW.user_id,
    rp.permission_id,
    NEW.user_id
  FROM public.role_permissions rp
  WHERE rp.role = NEW.role
     OR (NEW.role IN ('owner', 'akuntan') AND rp.role = 'admin')
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$function$;