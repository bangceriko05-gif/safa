CREATE TABLE public.product_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_collections_store ON public.product_collections(store_id);
ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view collections in their stores"
  ON public.product_collections FOR SELECT
  USING (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));
CREATE POLICY "Users can insert collections in their stores"
  ON public.product_collections FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));
CREATE POLICY "Users can update collections in their stores"
  ON public.product_collections FOR UPDATE
  USING (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));
CREATE POLICY "Users can delete collections in their stores"
  ON public.product_collections FOR DELETE
  USING (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));

CREATE TRIGGER update_product_collections_updated_at
  BEFORE UPDATE ON public.product_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.product_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_materials_store ON public.product_materials(store_id);
ALTER TABLE public.product_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view materials in their stores"
  ON public.product_materials FOR SELECT
  USING (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));
CREATE POLICY "Users can insert materials in their stores"
  ON public.product_materials FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));
CREATE POLICY "Users can update materials in their stores"
  ON public.product_materials FOR UPDATE
  USING (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));
CREATE POLICY "Users can delete materials in their stores"
  ON public.product_materials FOR DELETE
  USING (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));

CREATE TRIGGER update_product_materials_updated_at
  BEFORE UPDATE ON public.product_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.products
  ADD COLUMN collection_id UUID REFERENCES public.product_collections(id) ON DELETE SET NULL,
  ADD COLUMN material_id UUID REFERENCES public.product_materials(id) ON DELETE SET NULL;

CREATE INDEX idx_products_collection ON public.products(collection_id);
CREATE INDEX idx_products_material ON public.products(material_id);
