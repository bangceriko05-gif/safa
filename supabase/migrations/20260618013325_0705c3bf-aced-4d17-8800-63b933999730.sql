
CREATE OR REPLACE FUNCTION public.extract_factor_from_name(p_name text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  m text[];
BEGIN
  IF p_name IS NULL THEN RETURN 1; END IF;
  -- Match patterns like "(kg / 1000 gram)" or "(1 gram)"
  m := regexp_match(p_name, '/\s*([0-9]+(?:[.,][0-9]+)?)\s+[A-Za-z]');
  IF m IS NOT NULL THEN
    RETURN GREATEST(replace(m[1], ',', '.')::numeric, 1);
  END IF;
  RETURN 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_stock_in_to_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_id uuid;
BEGIN
  IF NEW.status = 'posted' AND (OLD.status IS DISTINCT FROM 'posted') THEN
    UPDATE public.products p
    SET stock_qty = p.stock_qty + (sii.quantity * public.extract_factor_from_name(sii.product_name))
    FROM public.stock_in_items sii
    WHERE sii.stock_in_id = NEW.id AND sii.product_id = p.id;

    FOR affected_id IN
      SELECT DISTINCT product_id FROM public.stock_in_items WHERE stock_in_id = NEW.id
    LOOP
      PERFORM public.recompute_product_avg_cost(affected_id);
    END LOOP;
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status = 'posted' THEN
    UPDATE public.products p
    SET stock_qty = p.stock_qty - (sii.quantity * public.extract_factor_from_name(sii.product_name))
    FROM public.stock_in_items sii
    WHERE sii.stock_in_id = NEW.id AND sii.product_id = p.id;

    FOR affected_id IN
      SELECT DISTINCT product_id FROM public.stock_in_items WHERE stock_in_id = NEW.id
    LOOP
      PERFORM public.recompute_product_avg_cost(affected_id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_stock_out_to_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'posted' AND (OLD.status IS DISTINCT FROM 'posted') THEN
    UPDATE public.products p
    SET stock_qty = p.stock_qty - (soi.quantity * public.extract_factor_from_name(soi.product_name))
    FROM public.stock_out_items soi
    WHERE soi.stock_out_id = NEW.id AND soi.product_id = p.id;
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status = 'posted' THEN
    UPDATE public.products p
    SET stock_qty = p.stock_qty + (soi.quantity * public.extract_factor_from_name(soi.product_name))
    FROM public.stock_out_items soi
    WHERE soi.stock_out_id = NEW.id AND soi.product_id = p.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill: recompute stock_qty for every product using the latest posted opname as anchor
UPDATE public.products p SET stock_qty = sub.new_qty
FROM (
  SELECT p.id,
    COALESCE(op.actual_stock, 0)
      + COALESCE(i.ins, 0)
      - COALESCE(o.outs, 0) AS new_qty
  FROM public.products p
  LEFT JOIN LATERAL (
    SELECT spi.actual_stock, sp.posted_at
    FROM public.stock_opname_items spi
    JOIN public.stock_opname sp ON sp.id = spi.stock_opname_id
    WHERE spi.product_id = p.id AND sp.status = 'posted'
    ORDER BY sp.posted_at DESC NULLS LAST
    LIMIT 1
  ) op ON true
  LEFT JOIN LATERAL (
    SELECT SUM(sii.quantity * public.extract_factor_from_name(sii.product_name)) AS ins
    FROM public.stock_in_items sii
    JOIN public.stock_in si ON si.id = sii.stock_in_id
    WHERE sii.product_id = p.id AND si.status = 'posted'
      AND (op.posted_at IS NULL OR si.posted_at > op.posted_at)
  ) i ON true
  LEFT JOIN LATERAL (
    SELECT SUM(soi.quantity * public.extract_factor_from_name(soi.product_name)) AS outs
    FROM public.stock_out_items soi
    JOIN public.stock_out so ON so.id = soi.stock_out_id
    WHERE soi.product_id = p.id AND so.status = 'posted'
      AND (op.posted_at IS NULL OR so.posted_at > op.posted_at)
  ) o ON true
) sub
WHERE sub.id = p.id;
