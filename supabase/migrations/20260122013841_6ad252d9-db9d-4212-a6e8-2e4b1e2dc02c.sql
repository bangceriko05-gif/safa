-- Create a function to cleanup storage objects for a deleted user
-- This sets the owner to NULL so auth.users can be deleted
CREATE OR REPLACE FUNCTION public.cleanup_storage_for_deleted_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update storage objects to set owner to null
  -- This prevents foreign key constraint errors when deleting auth user
  UPDATE storage.objects 
  SET owner = NULL, owner_id = NULL
  WHERE owner = p_user_id;
  
  -- Also check if there are any other references
  -- The owner column in storage.objects references auth.users(id)
  -- Setting to NULL allows the user deletion to proceed
END;
$$;

-- Grant execute permission to authenticated users (via service role in edge function)
GRANT EXECUTE ON FUNCTION public.cleanup_storage_for_deleted_user(uuid) TO service_role;