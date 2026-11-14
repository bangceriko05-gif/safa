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
  SELECT COALESCE(v.purchase_price, p.purchase_price)
    INTO v_cost
  FROM public.product_variants v
  JOIN public.products p ON p.id = v.product_id
  WHERE v.id = p_id;
  IF v_cost IS NOT NULL THEN RETURN v_cost; END IF;

  SELECT p.purchase_price INTO v_cost
  FROM public.products p
  WHERE p.id = p_id;
  RETURN v_cost;
END;
$$;
REVOKE ALL ON FUNCTION public.transaction_product_cost(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transaction_product_cost(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.snapshot_booking_room_terms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_variant record;
BEGIN
  IF NEW.variant_id IS NOT NULL THEN
    SELECT price, booking_duration_type, booking_duration_value
      INTO v_variant
    FROM public.room_variants
    WHERE id = NEW.variant_id;

    IF TG_OP = 'UPDATE' AND NEW.variant_id IS DISTINCT FROM OLD.variant_id THEN
      IF NEW.variant_price_override IS NOT DISTINCT FROM OLD.variant_price_override THEN
        NEW.variant_price_override := v_variant.price;
      END IF;
      NEW.booking_duration_type := COALESCE(v_variant.booking_duration_type, 'hours');
      NEW.booking_duration_value := COALESCE(v_variant.booking_duration_value, NEW.duration);
    ELSE
      NEW.variant_price_override := COALESCE(NEW.variant_price_override, v_variant.price);
      NEW.booking_duration_type := COALESCE(NEW.booking_duration_type, v_variant.booking_duration_type, 'hours');
      NEW.booking_duration_value := COALESCE(NEW.booking_duration_value, v_variant.booking_duration_value, NEW.duration);
    END IF;
  ELSE
    NEW.booking_duration_type := COALESCE(NEW.booking_duration_type, 'days');
    NEW.booking_duration_value := COALESCE(NEW.booking_duration_value, NEW.duration);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_transaction_value_snapshots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  UPDATE public.booking_order_items i
  SET unit_cost = COALESCE(
    (SELECT COALESCE(v.purchase_price, p.purchase_price)
     FROM public.product_variants v
     JOIN public.products p ON p.id = v.product_id
     WHERE v.id = i.product_id),
    (SELECT p.purchase_price FROM public.products p WHERE p.id = i.product_id)
  )
  WHERE i.unit_cost IS NULL;

  UPDATE public.booking_products i
  SET unit_cost = COALESCE(
    (SELECT COALESCE(v.purchase_price, p.purchase_price)
     FROM public.product_variants v
     JOIN public.products p ON p.id = v.product_id
     WHERE v.id = i.product_id),
    (SELECT p.purchase_price FROM public.products p WHERE p.id = i.product_id)
  )
  WHERE i.unit_cost IS NULL;

  UPDATE public.bookings b
  SET variant_price_override = COALESCE(b.variant_price_override, v.price),
      booking_duration_type = COALESCE(b.booking_duration_type, v.booking_duration_type, 'hours'),
      booking_duration_value = COALESCE(b.booking_duration_value, v.booking_duration_value, b.duration)
  FROM public.room_variants v
  WHERE v.id = b.variant_id
    AND (b.variant_price_override IS NULL OR b.booking_duration_type IS NULL OR b.booking_duration_value IS NULL);

  UPDATE public.bookings
  SET booking_duration_type = COALESCE(booking_duration_type, 'days'),
      booking_duration_value = COALESCE(booking_duration_value, duration)
  WHERE variant_id IS NULL
    AND (booking_duration_type IS NULL OR booking_duration_value IS NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.backfill_transaction_value_snapshots() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_transaction_value_snapshots() TO service_role;
SELECT public.backfill_transaction_value_snapshots();
DROP FUNCTION public.backfill_transaction_value_snapshots();
