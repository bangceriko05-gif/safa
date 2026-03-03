
-- Drop existing restrictive policies for customers
DROP POLICY IF EXISTS "Users can delete customers in their stores" ON public.customers;
DROP POLICY IF EXISTS "Users can update customers in their stores" ON public.customers;

-- Recreate policies allowing all store users to update and delete
CREATE POLICY "Users can update customers in their stores"
ON public.customers
FOR UPDATE
USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Users can delete customers in their stores"
ON public.customers
FOR DELETE
USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));
