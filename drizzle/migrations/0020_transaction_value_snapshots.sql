ALTER TABLE public.booking_order_items
  ADD COLUMN IF NOT EXISTS unit_cost numeric;
ALTER TABLE public.booking_products
  ADD COLUMN IF NOT EXISTS unit_cost numeric;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_duration_type text,
  ADD COLUMN IF NOT EXISTS booking_duration_value numeric;

COMMENT ON COLUMN public.booking_order_items.unit_cost IS 'HPP per unit saat baris transaksi dibuat; baris lama diisi sekali dari HPP yang tersedia saat backfill.';
COMMENT ON COLUMN public.booking_products.unit_cost IS 'HPP per unit saat baris transaksi dibuat; baris lama diisi sekali dari HPP yang tersedia saat backfill.';
COMMENT ON COLUMN public.bookings.booking_duration_type IS 'Satuan billing kamar yang disimpan saat booking agar perubahan varian tidak mengubah transaksi lama.';
COMMENT ON COLUMN public.bookings.booking_duration_value IS 'Nilai durasi billing kamar yang disimpan saat booking agar perubahan varian tidak mengubah transaksi lama.';

CREATE OR REPLACE FUNCTION public.transaction_product_cost(p_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.transaction_product_cost(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transaction_product_cost(uuid) TO authenticated, service_role;

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
      NEW.unit_cost := OLD.unit_cost;
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
      NEW.unit_cost := OLD.unit_cost;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.unit_cost IS NULL THEN
    NEW.unit_cost := public.transaction_product_cost(NEW.product_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS snapshot_pos_item_cost ON public.booking_order_items;
CREATE TRIGGER snapshot_pos_item_cost
BEFORE INSERT OR UPDATE OF product_id, unit_cost ON public.booking_order_items
FOR EACH ROW EXECUTE FUNCTION public.snapshot_pos_item_cost();

DROP TRIGGER IF EXISTS snapshot_booking_product_cost ON public.booking_products;
CREATE TRIGGER snapshot_booking_product_cost
BEFORE INSERT OR UPDATE OF product_id, unit_cost ON public.booking_products
FOR EACH ROW EXECUTE FUNCTION public.snapshot_booking_product_cost();

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
    NEW.variant_price_override := COALESCE(NEW.variant_price_override, v_variant.price);
    NEW.booking_duration_type := COALESCE(NEW.booking_duration_type, v_variant.booking_duration_type, 'hours');
    NEW.booking_duration_value := COALESCE(NEW.booking_duration_value, v_variant.booking_duration_value, NEW.duration);
  ELSE
    NEW.booking_duration_type := COALESCE(NEW.booking_duration_type, 'days');
    NEW.booking_duration_value := COALESCE(NEW.booking_duration_value, NEW.duration);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS snapshot_booking_room_terms ON public.bookings;
CREATE TRIGGER snapshot_booking_room_terms
BEFORE INSERT OR UPDATE OF variant_id ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.snapshot_booking_room_terms();

UPDATE public.booking_order_items
SET unit_cost = public.transaction_product_cost(product_id)
WHERE unit_cost IS NULL;

UPDATE public.booking_products
SET unit_cost = public.transaction_product_cost(product_id)
WHERE unit_cost IS NULL;

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

CREATE OR REPLACE FUNCTION public.update_shared_booking_billing(p_booking_id uuid, p_payment jsonb, p_room_rates jsonb, p_products jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_group uuid;
  v_store uuid;
  v_owner uuid;
  v_count integer;
  v_updated integer;
  v_rate jsonb;
  v_costs jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT booking_group_id, store_id INTO v_group, v_store FROM public.bookings WHERE id = p_booking_id;
  IF v_group IS NULL THEN RAISE EXCEPTION 'Grouped booking required'; END IF;
  PERFORM id FROM public.bookings WHERE booking_group_id = v_group AND store_id = v_store ORDER BY id FOR UPDATE;
  SELECT count(*) INTO v_count FROM public.bookings WHERE booking_group_id = v_group AND store_id = v_store;
  SELECT id INTO v_owner FROM public.bookings WHERE booking_group_id = v_group AND store_id = v_store
    ORDER BY (CASE WHEN payment_proof_url IS NOT NULL THEN 8 ELSE 0 END + CASE WHEN payment_method IS NOT NULL THEN 4 ELSE 0 END + CASE WHEN price > 0 THEN 2 ELSE 0 END + CASE WHEN discount_value > 0 THEN 1 ELSE 0 END) DESC, id LIMIT 1;
  IF v_count < 2 OR v_owner IS NULL THEN RAISE EXCEPTION 'Incomplete booking group'; END IF;
  IF COALESCE((p_payment->>'price')::numeric, 0) < 0 OR COALESCE((p_payment->>'price_2')::numeric, 0) < 0 THEN RAISE EXCEPTION 'Invalid payment'; END IF;

  FOR v_rate IN SELECT value FROM jsonb_array_elements(p_room_rates) LOOP
    UPDATE public.bookings
    SET variant_price_override = (v_rate->>'rate')::numeric,
        booking_duration_type = COALESCE(v_rate->>'booking_duration_type', booking_duration_type),
        booking_duration_value = COALESCE((v_rate->>'booking_duration_value')::numeric, booking_duration_value)
    WHERE id = (v_rate->>'id')::uuid AND booking_group_id = v_group AND store_id = v_store AND status IS DISTINCT FROM 'BATAL';
    IF NOT FOUND THEN RAISE EXCEPTION 'Room unavailable for billing update'; END IF;
  END LOOP;

  UPDATE public.bookings SET
    price = CASE WHEN id = v_owner THEN COALESCE((p_payment->>'price')::numeric, 0) ELSE 0 END,
    price_2 = CASE WHEN id = v_owner THEN (p_payment->>'price_2')::numeric ELSE NULL END,
    dual_payment = CASE WHEN id = v_owner THEN COALESCE((p_payment->>'dual_payment')::boolean, false) ELSE false END,
    payment_method = CASE WHEN id = v_owner THEN p_payment->>'payment_method' ELSE NULL END,
    payment_method_2 = CASE WHEN id = v_owner THEN p_payment->>'payment_method_2' ELSE NULL END,
    reference_no = CASE WHEN id = v_owner THEN p_payment->>'reference_no' ELSE '-' END,
    reference_no_2 = CASE WHEN id = v_owner THEN p_payment->>'reference_no_2' ELSE NULL END,
    payment_proof_url = CASE WHEN id = v_owner THEN p_payment->>'payment_proof_url' ELSE NULL END,
    payment_proof_url_2 = CASE WHEN id = v_owner THEN p_payment->>'payment_proof_url_2' ELSE NULL END,
    discount_type = CASE WHEN id = v_owner THEN p_payment->>'discount_type' ELSE NULL END,
    discount_value = CASE WHEN id = v_owner THEN COALESCE((p_payment->>'discount_value')::numeric, 0) ELSE 0 END,
    discount_applies_to = CASE WHEN id = v_owner THEN p_payment->>'discount_applies_to' ELSE NULL END,
    payment_status = p_payment->>'payment_status'
  WHERE booking_group_id = v_group AND store_id = v_store;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> v_count THEN RAISE EXCEPTION 'Not authorized to update entire group'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', product_id, 'product_name', product_name, 'unit_cost', unit_cost)), '[]'::jsonb)
    INTO v_costs
  FROM public.booking_products
  WHERE booking_id IN (SELECT id FROM public.bookings WHERE booking_group_id = v_group AND store_id = v_store);

  DELETE FROM public.booking_products WHERE booking_id IN (SELECT id FROM public.bookings WHERE booking_group_id = v_group AND store_id = v_store);

  INSERT INTO public.booking_products(booking_id, product_id, product_name, product_price, quantity, subtotal, unit_cost)
  SELECT v_owner,
    (value->>'product_id')::uuid,
    value->>'product_name',
    (value->>'product_price')::numeric,
    (value->>'quantity')::integer,
    (value->>'subtotal')::numeric,
    COALESCE(
      (value->>'unit_cost')::numeric,
      (SELECT (previous->>'unit_cost')::numeric
       FROM jsonb_array_elements(v_costs) previous
       WHERE previous->>'product_id' = value->>'product_id'
         AND previous->>'product_name' = value->>'product_name'
       LIMIT 1)
    )
  FROM jsonb_array_elements(p_products);
END;
$$;
REVOKE ALL ON FUNCTION public.update_shared_booking_billing(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_shared_booking_billing(uuid, jsonb, jsonb, jsonb) TO authenticated, service_role;
