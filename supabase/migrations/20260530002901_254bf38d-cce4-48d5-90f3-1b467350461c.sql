ALTER TABLE public.product_recipes
DROP CONSTRAINT IF EXISTS product_recipes_ingredient_product_id_fkey;

ALTER TABLE public.product_recipes
ADD CONSTRAINT product_recipes_ingredient_product_id_fkey
FOREIGN KEY (ingredient_product_id)
REFERENCES public.products(id)
ON DELETE CASCADE;