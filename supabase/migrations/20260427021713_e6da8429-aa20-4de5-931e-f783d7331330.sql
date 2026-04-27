-- Add new fields to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS category_id UUID,
  ADD COLUMN IF NOT EXISTS brand_id UUID,
  ADD COLUMN IF NOT EXISTS purchase_price NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_stock NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_on_website BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Product categories table
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view product categories in their stores"
  ON public.product_categories FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Users can insert product categories in their stores"
  ON public.product_categories FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = created_by) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

CREATE POLICY "Users can update product categories in their stores"
  ON public.product_categories FOR UPDATE
  TO authenticated
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Users can delete product categories in their stores"
  ON public.product_categories FOR DELETE
  TO authenticated
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Product brands table
CREATE TABLE IF NOT EXISTS public.product_brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view product brands in their stores"
  ON public.product_brands FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Users can insert product brands in their stores"
  ON public.product_brands FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = created_by) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

CREATE POLICY "Users can update product brands in their stores"
  ON public.product_brands FOR UPDATE
  TO authenticated
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Users can delete product brands in their stores"
  ON public.product_brands FOR DELETE
  TO authenticated
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE TRIGGER update_product_brands_updated_at
  BEFORE UPDATE ON public.product_brands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Product variants table
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  variant_name TEXT NOT NULL,
  sku TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  stock NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view product variants in their stores"
  ON public.product_variants FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), p.store_id))
  ));

CREATE POLICY "Users can insert product variants in their stores"
  ON public.product_variants FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), p.store_id))
  ));

CREATE POLICY "Users can update product variants in their stores"
  ON public.product_variants FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), p.store_id))
  ));

CREATE POLICY "Users can delete product variants in their stores"
  ON public.product_variants FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), p.store_id))
  ));

CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Product price tiers table (wholesale tiers)
CREATE TABLE IF NOT EXISTS public.product_price_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  min_quantity NUMERIC NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL DEFAULT 0,
  label TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_price_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view price tiers in their stores"
  ON public.product_price_tiers FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_price_tiers.product_id
      AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), p.store_id))
  ));

CREATE POLICY "Users can insert price tiers in their stores"
  ON public.product_price_tiers FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_price_tiers.product_id
      AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), p.store_id))
  ));

CREATE POLICY "Users can update price tiers in their stores"
  ON public.product_price_tiers FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_price_tiers.product_id
      AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), p.store_id))
  ));

CREATE POLICY "Users can delete price tiers in their stores"
  ON public.product_price_tiers FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_price_tiers.product_id
      AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), p.store_id))
  ));

CREATE TRIGGER update_product_price_tiers_updated_at
  BEFORE UPDATE ON public.product_price_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');