UPDATE public.product_materials SET name = 'bahan baku' WHERE lower(name) = 'bahan mentah';

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
  VALUES (NEW.id, 'bahan baku', true, seeder), (NEW.id, 'kemasan', true, seeder)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;