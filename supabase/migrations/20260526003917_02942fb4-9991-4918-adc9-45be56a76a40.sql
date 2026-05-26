ALTER TABLE public.product_units
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_units_store_id_name_key'
  ) THEN
    ALTER TABLE public.product_units
      ADD CONSTRAINT product_units_store_id_name_key UNIQUE (store_id, name);
  END IF;
END$$;

INSERT INTO public.product_units (store_id, name, is_default)
SELECT s.id, u.name, true
FROM public.stores s
CROSS JOIN (VALUES ('pcs'),('kg'),('gram'),('liter'),('ml'),('dus'),('lusin'),('kodi')) AS u(name)
ON CONFLICT (store_id, name) DO UPDATE SET is_default = true;

CREATE OR REPLACE FUNCTION public.seed_default_product_units()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.product_units (store_id, name, is_default)
  VALUES
    (NEW.id, 'pcs', true),
    (NEW.id, 'kg', true),
    (NEW.id, 'gram', true),
    (NEW.id, 'liter', true),
    (NEW.id, 'ml', true),
    (NEW.id, 'dus', true),
    (NEW.id, 'lusin', true),
    (NEW.id, 'kodi', true)
  ON CONFLICT (store_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_product_units ON public.stores;
CREATE TRIGGER trg_seed_default_product_units
AFTER INSERT ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.seed_default_product_units();