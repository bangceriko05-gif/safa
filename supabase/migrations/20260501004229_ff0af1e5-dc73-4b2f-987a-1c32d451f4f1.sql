
-- Master satuan per store
CREATE TABLE public.product_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users with store access can view units"
  ON public.product_units FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));
CREATE POLICY "Users with store access can manage units"
  ON public.product_units FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id))
  WITH CHECK (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

-- Resep / bahan: ingredient yang dipakai oleh produk (atau varian tertentu)
CREATE TABLE public.product_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  ingredient_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  qty NUMERIC NOT NULL DEFAULT 1,
  unit_from TEXT,
  unit_to TEXT,
  unit_factor NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_recipes_product_id ON public.product_recipes(product_id);
CREATE INDEX idx_product_recipes_variant_id ON public.product_recipes(variant_id);
ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users with store access can view recipes"
  ON public.product_recipes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), p.store_id))));
CREATE POLICY "Users with store access can manage recipes"
  ON public.product_recipes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), p.store_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), p.store_id))));

-- Konversi satuan per produk: dus -> pcs, dll
CREATE TABLE public.product_unit_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  from_unit TEXT NOT NULL,
  to_unit TEXT NOT NULL,
  factor NUMERIC NOT NULL DEFAULT 1,
  price_per_from NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_unit_conversions_product_id ON public.product_unit_conversions(product_id);
ALTER TABLE public.product_unit_conversions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users with store access can view conversions"
  ON public.product_unit_conversions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), p.store_id))));
CREATE POLICY "Users with store access can manage conversions"
  ON public.product_unit_conversions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), p.store_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), p.store_id))));

-- updated_at triggers
CREATE TRIGGER update_product_units_updated_at BEFORE UPDATE ON public.product_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_product_recipes_updated_at BEFORE UPDATE ON public.product_recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_product_unit_conversions_updated_at BEFORE UPDATE ON public.product_unit_conversions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
