CREATE OR REPLACE FUNCTION public.transaction_product_cost(p_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE v_cost numeric;
BEGIN
  SELECT v.purchase_price INTO v_cost
  FROM public.product_variants v
  WHERE v.id = p_id;
  IF v_cost IS NOT NULL THEN RETURN v_cost; END IF;

  SELECT p.purchase_price INTO v_cost
  FROM public.products p
  WHERE p.id = p_id;
  IF v_cost IS NOT NULL THEN RETURN v_cost; END IF;

  SELECT p.purchase_price INTO v_cost
  FROM public.product_variants v
  JOIN public.products p ON p.id = v.product_id
  WHERE v.id = p_id;
  RETURN v_cost;
END;
$$;
REVOKE ALL ON FUNCTION public.transaction_product_cost(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transaction_product_cost(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.backfill_orphan_variant_costs()
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
REVOKE ALL ON FUNCTION public.backfill_orphan_variant_costs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_orphan_variant_costs() TO service_role;
SELECT public.backfill_orphan_variant_costs();
DROP FUNCTION public.backfill_orphan_variant_costs();
