CREATE OR REPLACE FUNCTION public.accessible_store_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_store_access WHERE user_id = _user_id AND role = 'super_admin')
      THEN (SELECT COALESCE(array_agg(id), '{}'::uuid[]) FROM public.stores)
    ELSE (SELECT COALESCE(array_agg(store_id), '{}'::uuid[]) FROM public.user_store_access WHERE user_id = _user_id)
  END
$$;

GRANT EXECUTE ON FUNCTION public.accessible_store_ids(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can view customers in their stores" ON public.customers;
CREATE POLICY "Users can view customers in their stores" ON public.customers
FOR SELECT TO authenticated
USING (store_id = ANY (COALESCE((SELECT public.accessible_store_ids((SELECT auth.uid()))), '{}'::uuid[])));

DROP POLICY IF EXISTS "Users can update customers in their stores" ON public.customers;
CREATE POLICY "Users can update customers in their stores" ON public.customers
FOR UPDATE TO authenticated
USING (store_id = ANY (COALESCE((SELECT public.accessible_store_ids((SELECT auth.uid()))), '{}'::uuid[])));

DROP POLICY IF EXISTS "Users can delete customers in their stores" ON public.customers;
CREATE POLICY "Users can delete customers in their stores" ON public.customers
FOR DELETE TO authenticated
USING (store_id = ANY (COALESCE((SELECT public.accessible_store_ids((SELECT auth.uid()))), '{}'::uuid[])));

DROP POLICY IF EXISTS "Users can view products in their stores" ON public.products;
CREATE POLICY "Users can view products in their stores" ON public.products
FOR SELECT TO authenticated
USING (
  store_id = ANY (COALESCE((SELECT public.accessible_store_ids((SELECT auth.uid()))), '{}'::uuid[]))
  AND (
    (SELECT public.is_super_admin((SELECT auth.uid())))
    OR (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','leader','owner','akuntan']::app_role[]))
    OR (SELECT public.has_permission((SELECT auth.uid()), 'view_products'))
    OR (SELECT public.has_permission((SELECT auth.uid()), 'view_product_detail'))
    OR (SELECT public.has_permission((SELECT auth.uid()), 'manage_products'))
    OR (SELECT public.has_permission((SELECT auth.uid()), 'create_products'))
    OR (SELECT public.has_permission((SELECT auth.uid()), 'delete_products'))
  )
);

DROP POLICY IF EXISTS "Users can update products in their stores" ON public.products;
CREATE POLICY "Users can update products in their stores" ON public.products
FOR UPDATE TO authenticated
USING (
  store_id = ANY (COALESCE((SELECT public.accessible_store_ids((SELECT auth.uid()))), '{}'::uuid[]))
  AND (
    (SELECT public.is_super_admin((SELECT auth.uid())))
    OR (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','leader','owner','akuntan']::app_role[]))
    OR (SELECT public.has_permission((SELECT auth.uid()), 'manage_products'))
  )
);

DROP POLICY IF EXISTS "Users can delete products in their stores" ON public.products;
CREATE POLICY "Users can delete products in their stores" ON public.products
FOR DELETE TO authenticated
USING (
  store_id = ANY (COALESCE((SELECT public.accessible_store_ids((SELECT auth.uid()))), '{}'::uuid[]))
  AND (
    (SELECT public.is_super_admin((SELECT auth.uid())))
    OR (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','leader','owner','akuntan']::app_role[]))
    OR (SELECT public.has_permission((SELECT auth.uid()), 'delete_products'))
  )
);

DROP POLICY IF EXISTS "Users can view incomes in their stores" ON public.incomes;
CREATE POLICY "Users can view incomes in their stores" ON public.incomes
FOR SELECT TO authenticated
USING (store_id = ANY (COALESCE((SELECT public.accessible_store_ids((SELECT auth.uid()))), '{}'::uuid[])));

DROP POLICY IF EXISTS "Admins and leaders can update incomes in their stores" ON public.incomes;
CREATE POLICY "Admins and leaders can update incomes in their stores" ON public.incomes
FOR UPDATE TO authenticated
USING (
  store_id = ANY (COALESCE((SELECT public.accessible_store_ids((SELECT auth.uid()))), '{}'::uuid[]))
  AND (
    created_by = (SELECT auth.uid())
    OR (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','leader','owner','akuntan']::app_role[]))
  )
);

DROP POLICY IF EXISTS "Admins and leaders can delete incomes in their stores" ON public.incomes;
CREATE POLICY "Admins and leaders can delete incomes in their stores" ON public.incomes
FOR DELETE TO authenticated
USING (
  store_id = ANY (COALESCE((SELECT public.accessible_store_ids((SELECT auth.uid()))), '{}'::uuid[]))
  AND (
    created_by = (SELECT auth.uid())
    OR (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','leader','owner','akuntan']::app_role[]))
  )
);

DROP POLICY IF EXISTS "Users can view income products in their stores" ON public.income_products;
CREATE POLICY "Users can view income products in their stores" ON public.income_products
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.incomes i
  WHERE i.id = income_products.income_id
    AND i.store_id = ANY (COALESCE((SELECT public.accessible_store_ids((SELECT auth.uid()))), '{}'::uuid[]))
));

DROP POLICY IF EXISTS "Admins and leaders can delete income products" ON public.income_products;
CREATE POLICY "Admins and leaders can delete income products" ON public.income_products
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.incomes i
  WHERE i.id = income_products.income_id
    AND i.store_id = ANY (COALESCE((SELECT public.accessible_store_ids((SELECT auth.uid()))), '{}'::uuid[]))
));

DROP POLICY IF EXISTS "Users can view room daily status in their stores" ON public.room_daily_status;
CREATE POLICY "Users can view room daily status in their stores" ON public.room_daily_status
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.rooms r
  WHERE r.id = room_daily_status.room_id
    AND r.store_id = ANY (COALESCE((SELECT public.accessible_store_ids((SELECT auth.uid()))), '{}'::uuid[]))
));

DROP POLICY IF EXISTS "Users with permission can manage room daily status" ON public.room_daily_status;
CREATE POLICY "Users with permission can manage room daily status" ON public.room_daily_status
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.rooms r
  WHERE r.id = room_daily_status.room_id
    AND r.store_id = ANY (COALESCE((SELECT public.accessible_store_ids((SELECT auth.uid()))), '{}'::uuid[]))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.rooms r
  WHERE r.id = room_daily_status.room_id
    AND r.store_id = ANY (COALESCE((SELECT public.accessible_store_ids((SELECT auth.uid()))), '{}'::uuid[]))
));

DROP POLICY IF EXISTS "Users can view active room variants in their stores" ON public.room_variants;
CREATE POLICY "Users can view active room variants in their stores" ON public.room_variants
FOR SELECT TO authenticated
USING (is_active = true AND store_id = ANY (COALESCE((SELECT public.accessible_store_ids((SELECT auth.uid()))), '{}'::uuid[])));

DROP POLICY IF EXISTS "Admins and leaders can manage room variants in their stores" ON public.room_variants;
CREATE POLICY "Admins and leaders can manage room variants in their stores" ON public.room_variants
FOR ALL TO authenticated
USING (
  store_id = ANY (COALESCE((SELECT public.accessible_store_ids((SELECT auth.uid()))), '{}'::uuid[]))
  AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','leader','owner','akuntan']::app_role[]))
)
WITH CHECK (
  store_id = ANY (COALESCE((SELECT public.accessible_store_ids((SELECT auth.uid()))), '{}'::uuid[]))
  AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['admin','leader','owner','akuntan']::app_role[]))
);

CREATE INDEX IF NOT EXISTS idx_room_daily_status_date_room ON public.room_daily_status (date, room_id);
CREATE INDEX IF NOT EXISTS idx_income_products_income_id ON public.income_products (income_id);
