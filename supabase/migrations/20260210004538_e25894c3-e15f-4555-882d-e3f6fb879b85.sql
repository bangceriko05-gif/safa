
-- Drop restrictive UPDATE and DELETE policies
DROP POLICY "Admins and leaders can delete deposits in their stores" ON public.room_deposits;
DROP POLICY "Admins and leaders can update deposits in their stores" ON public.room_deposits;

-- Create new policies allowing all authenticated users with store access
CREATE POLICY "Users can update deposits in their stores"
ON public.room_deposits
FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Users can delete deposits in their stores"
ON public.room_deposits
FOR DELETE
TO authenticated
USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));
