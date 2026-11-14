CREATE OR REPLACE FUNCTION public.snapshot_pos_item_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.product_id IS DISTINCT FROM OLD.product_id THEN
      NEW.unit_cost := public.transaction_product_cost(NEW.product_id);
    ELSE
      NEW.unit_cost := COALESCE(OLD.unit_cost, NEW.unit_cost);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.unit_cost IS NULL THEN
    NEW.unit_cost := public.transaction_product_cost(NEW.product_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.snapshot_booking_product_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.product_id IS DISTINCT FROM OLD.product_id THEN
      NEW.unit_cost := public.transaction_product_cost(NEW.product_id);
    ELSE
      NEW.unit_cost := COALESCE(OLD.unit_cost, NEW.unit_cost);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.unit_cost IS NULL THEN
    NEW.unit_cost := public.transaction_product_cost(NEW.product_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_initial_item_costs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  UPDATE public.booking_order_items
  SET unit_cost = public.transaction_product_cost(product_id)
  WHERE unit_cost IS NULL;

  UPDATE public.booking_products
  SET unit_cost = public.transaction_product_cost(product_id)
  WHERE unit_cost IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.backfill_initial_item_costs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_initial_item_costs() TO service_role;
SELECT public.backfill_initial_item_costs();
DROP FUNCTION public.backfill_initial_item_costs();
