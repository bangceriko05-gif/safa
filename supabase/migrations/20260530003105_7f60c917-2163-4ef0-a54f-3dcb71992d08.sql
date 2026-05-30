DROP POLICY IF EXISTS "Users can view products in their stores" ON public.products;
DROP POLICY IF EXISTS "Users can insert products in their stores" ON public.products;
DROP POLICY IF EXISTS "Admins and leaders can update products in their stores" ON public.products;
DROP POLICY IF EXISTS "Admins and leaders can delete products in their stores" ON public.products;

CREATE POLICY "Users can view products in their stores"
ON public.products
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    has_store_access(auth.uid(), store_id)
    AND (
      has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role])
      OR public.has_permission(auth.uid(), 'view_products')
      OR public.has_permission(auth.uid(), 'view_product_detail')
      OR public.has_permission(auth.uid(), 'manage_products')
      OR public.has_permission(auth.uid(), 'create_products')
      OR public.has_permission(auth.uid(), 'delete_products')
    )
  )
);

CREATE POLICY "Users can insert products in their stores"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (
    is_super_admin(auth.uid())
    OR (
      has_store_access(auth.uid(), store_id)
      AND (
        has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role])
        OR public.has_permission(auth.uid(), 'create_products')
      )
    )
  )
);

CREATE POLICY "Users can update products in their stores"
ON public.products
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    has_store_access(auth.uid(), store_id)
    AND (
      has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role])
      OR public.has_permission(auth.uid(), 'manage_products')
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    has_store_access(auth.uid(), store_id)
    AND (
      has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role])
      OR public.has_permission(auth.uid(), 'manage_products')
    )
  )
);

CREATE POLICY "Users can delete products in their stores"
ON public.products
FOR DELETE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    has_store_access(auth.uid(), store_id)
    AND (
      has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role, 'owner'::app_role, 'akuntan'::app_role])
      OR public.has_permission(auth.uid(), 'delete_products')
    )
  )
);