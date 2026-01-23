
-- Create a function to get user IDs that have any store access
-- This runs with SECURITY DEFINER to bypass RLS for orphan detection
CREATE OR REPLACE FUNCTION public.get_user_ids_with_any_store_access()
RETURNS TABLE (user_id uuid) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT DISTINCT usa.user_id FROM user_store_access usa;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_ids_with_any_store_access() TO authenticated;
