ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.get_public_shop_catalog();

CREATE FUNCTION public.get_public_shop_catalog()
RETURNS TABLE(
  store_id uuid, store_name text, store_slug text, store_description text,
  store_location text, store_image_url text, product_id uuid, product_name text,
  product_description text, product_price numeric, product_images jsonb,
  product_stock numeric, track_inventory boolean, is_featured boolean,
  category_id uuid, category_name text, variant_id uuid, variant_name text,
  variant_price numeric, variant_stock numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    s.id, s.name, s.slug, s.description, s.location, s.image_url,
    p.id, p.name, p.description, p.price, p.images::jsonb, p.stock_qty,
    p.track_inventory, p.is_featured,
    c.id, c.name, v.id, v.variant_name, v.price, v.stock
  FROM public.products p
  JOIN public.stores s ON s.id = p.store_id
  LEFT JOIN public.product_categories c ON c.id = p.category_id
  LEFT JOIN public.product_collections col ON col.id = p.collection_id
  LEFT JOIN public.product_variants v ON v.product_id = p.id AND v.is_active = true
  WHERE s.is_active = true
    AND p.is_active = true
    AND p.show_on_website = true
    AND (c.id IS NULL OR c.show_on_website = true)
    AND (col.id IS NULL OR col.show_on_website = true)
  ORDER BY s.name, p.is_featured DESC, c.sort_order, c.name, p.name, v.variant_name;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_shop_catalog() TO anon, authenticated, service_role;