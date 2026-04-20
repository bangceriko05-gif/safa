
-- Allow akuntan and super_admin to permanently delete stock_in records
CREATE POLICY "Akuntan and super admin can delete stock_in"
ON public.stock_in
FOR DELETE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (has_any_role(auth.uid(), ARRAY['akuntan'::app_role]) AND has_store_access(auth.uid(), store_id))
);

-- Allow same roles to delete stock_in_items (cascade-like)
CREATE POLICY "Akuntan and super admin can delete stock_in_items"
ON public.stock_in_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stock_in si
    WHERE si.id = stock_in_items.stock_in_id
      AND (
        is_super_admin(auth.uid())
        OR (has_any_role(auth.uid(), ARRAY['akuntan'::app_role]) AND has_store_access(auth.uid(), si.store_id))
      )
  )
);
