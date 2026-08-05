ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pos_visible boolean NOT NULL DEFAULT true;

WITH ordered AS (
  SELECT id, row_number() OVER (PARTITION BY store_id ORDER BY name) AS rn
  FROM public.product_categories
)
UPDATE public.product_categories pc
SET sort_order = o.rn
FROM ordered o
WHERE pc.id = o.id AND pc.sort_order = 0;