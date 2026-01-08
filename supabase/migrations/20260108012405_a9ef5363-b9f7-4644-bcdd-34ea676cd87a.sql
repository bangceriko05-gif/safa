-- Add slug column to stores table
ALTER TABLE public.stores 
ADD COLUMN slug text UNIQUE;

-- Create index for slug lookups
CREATE INDEX idx_stores_slug ON public.stores(slug);

-- Generate initial slugs from store names (convert to lowercase, replace spaces with dashes)
UPDATE public.stores 
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g'));

-- Make slug NOT NULL after populating
ALTER TABLE public.stores 
ALTER COLUMN slug SET NOT NULL;

-- Create function to auto-generate slug on insert
CREATE OR REPLACE FUNCTION public.generate_store_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := LOWER(REGEXP_REPLACE(REGEXP_REPLACE(NEW.name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g'));
    
    -- Handle duplicates by appending a number
    DECLARE
      base_slug text := NEW.slug;
      counter integer := 1;
    BEGIN
      WHILE EXISTS (SELECT 1 FROM stores WHERE slug = NEW.slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) LOOP
        NEW.slug := base_slug || '-' || counter;
        counter := counter + 1;
      END LOOP;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate slug
CREATE TRIGGER trigger_generate_store_slug
BEFORE INSERT ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.generate_store_slug();