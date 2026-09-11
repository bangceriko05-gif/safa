ALTER FUNCTION public.get_public_shop_catalog() SECURITY INVOKER;

GRANT SELECT (id, name, slug, description, location, image_url, is_active) ON public.stores TO anon;
GRANT SELECT (id, name, description, price, images, stock_qty, track_inventory, category_id, store_id, is_active, show_on_website) ON public.products TO anon;
GRANT SELECT (id, name, store_id, sort_order) ON public.product_categories TO anon;
GRANT SELECT (id, product_id, variant_name, price, stock, is_active) ON public.product_variants TO anon;

CREATE POLICY "Public can view active shop stores"
ON public.stores
FOR SELECT
TO anon
USING (is_active = true);

CREATE POLICY "Public can view website products"
ON public.products
FOR SELECT
TO anon
USING (
  is_active = true
  AND show_on_website = true
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = products.store_id AND s.is_active = true
  )
);

CREATE POLICY "Public can view shop categories"
ON public.product_categories
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = product_categories.store_id AND s.is_active = true
  )
);

CREATE POLICY "Public can view active shop variants"
ON public.product_variants
FOR SELECT
TO anon
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_variants.product_id
      AND p.is_active = true
      AND p.show_on_website = true
      AND s.is_active = true
  )
);