
-- Function: recompute average purchase price using Moving Average Cost
CREATE OR REPLACE FUNCTION public.recompute_product_avg_cost(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
  running_qty numeric := 0;
  running_avg numeric := 0;
  new_qty numeric;
BEGIN
  FOR rec IN
    SELECT sii.quantity, sii.unit_price
    FROM public.stock_in_items sii
    JOIN public.stock_in si ON si.id = sii.stock_in_id
    WHERE sii.product_id = p_product_id
      AND si.status = 'posted'
    ORDER BY si.posted_at NULLS LAST, si.date, si.created_at, sii.created_at
  LOOP
    IF rec.quantity IS NULL OR rec.quantity <= 0 THEN
      CONTINUE;
    END IF;
    new_qty := running_qty + rec.quantity;
    IF new_qty > 0 THEN
      running_avg := (running_qty * running_avg + rec.quantity * COALESCE(rec.unit_price, 0)) / new_qty;
    END IF;
    running_qty := new_qty;
  END LOOP;

  UPDATE public.products
  SET purchase_price = running_avg,
      updated_at = now()
  WHERE id = p_product_id;
END;
$$;

-- Update stock-in trigger to also recompute MAC
CREATE OR REPLACE FUNCTION public.apply_stock_in_to_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  affected_id uuid;
BEGIN
  -- Transition: anything -> posted
  IF NEW.status = 'posted' AND (OLD.status IS DISTINCT FROM 'posted') THEN
    UPDATE public.products p
    SET stock_qty = p.stock_qty + sii.quantity
    FROM public.stock_in_items sii
    WHERE sii.stock_in_id = NEW.id AND sii.product_id = p.id;

    FOR affected_id IN
      SELECT DISTINCT product_id FROM public.stock_in_items WHERE stock_in_id = NEW.id
    LOOP
      PERFORM public.recompute_product_avg_cost(affected_id);
    END LOOP;
  END IF;

  -- Transition: posted -> cancelled
  IF NEW.status = 'cancelled' AND OLD.status = 'posted' THEN
    UPDATE public.products p
    SET stock_qty = p.stock_qty - sii.quantity
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
$function$;

-- Backfill existing products
DO $$
DECLARE
  pid uuid;
BEGIN
  FOR pid IN
    SELECT DISTINCT sii.product_id
    FROM public.stock_in_items sii
    JOIN public.stock_in si ON si.id = sii.stock_in_id
    WHERE si.status = 'posted'
  LOOP
    PERFORM public.recompute_product_avg_cost(pid);
  END LOOP;
END$$;
