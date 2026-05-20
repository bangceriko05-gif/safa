ALTER TABLE public.product_materials
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

DO $$
DECLARE
  fallback_user uuid;
BEGIN
  SELECT id INTO fallback_user FROM auth.users ORDER BY created_at LIMIT 1;
  IF fallback_user IS NULL THEN RETURN; END IF;

  INSERT INTO public.product_materials (store_id, name, is_default, created_by)
  SELECT s.id, v.name, true, fallback_user
  FROM public.stores s
  CROSS JOIN (VALUES ('bahan mentah'), ('kemasan')) AS v(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.product_materials pm
    WHERE pm.store_id = s.id AND lower(pm.name) = v.name
  );
END $$;

UPDATE public.product_materials
SET is_default = true
WHERE lower(name) IN ('bahan mentah', 'kemasan');

CREATE OR REPLACE FUNCTION public.seed_default_product_materials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seeder uuid;
BEGIN
  SELECT id INTO seeder FROM auth.users ORDER BY created_at LIMIT 1;
  IF seeder IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.product_materials (store_id, name, is_default, created_by)
  VALUES (NEW.id, 'bahan mentah', true, seeder), (NEW.id, 'kemasan', true, seeder)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_product_materials ON public.stores;
CREATE TRIGGER trg_seed_default_product_materials
AFTER INSERT ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.seed_default_product_materials();