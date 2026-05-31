
CREATE TABLE IF NOT EXISTS public.product_storages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_storages_store ON public.product_storages(store_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_storages TO authenticated;
GRANT ALL ON public.product_storages TO service_role;

ALTER TABLE public.product_storages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view storages in their stores"
ON public.product_storages FOR SELECT
USING (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));

CREATE POLICY "Users can insert storages in their stores"
ON public.product_storages FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));

CREATE POLICY "Users can update storages in their stores"
ON public.product_storages FOR UPDATE
USING (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));

CREATE POLICY "Users can delete storages in their stores"
ON public.product_storages FOR DELETE
USING (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));

CREATE TRIGGER update_product_storages_updated_at
BEFORE UPDATE ON public.product_storages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS storage_id uuid REFERENCES public.product_storages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_storage ON public.products(storage_id);
