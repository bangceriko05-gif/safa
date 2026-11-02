CREATE OR REPLACE FUNCTION public.resolve_stock_product_id(p_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT id FROM public.products WHERE id = p_id),
    (SELECT product_id FROM public.product_variants WHERE id = p_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.adjust_sale_stock(p_item_product uuid, p_qty numeric, p_name text, p_sign integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid uuid;
BEGIN
  IF p_item_product IS NULL OR COALESCE(p_qty, 0) = 0 THEN RETURN; END IF;
  v_pid := public.resolve_stock_product_id(p_item_product);
  IF v_pid IS NULL THEN RETURN; END IF;
  UPDATE public.products
     SET stock_qty = COALESCE(stock_qty, 0) + p_sign * p_qty * public.extract_factor_from_name(COALESCE(p_name, '')),
         updated_at = now()
   WHERE id = v_pid AND track_inventory = true;
END;
$$;

-- POS order items: deduct while the order is not cancelled
CREATE OR REPLACE FUNCTION public.apply_pos_item_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_active boolean;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT COALESCE(process_status, '') <> 'batal' INTO v_active FROM public.booking_orders WHERE id = OLD.booking_order_id;
    IF COALESCE(v_active, false) THEN
      PERFORM public.adjust_sale_stock(OLD.product_id, OLD.quantity, OLD.product_name, 1);
    END IF;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT COALESCE(process_status, '') <> 'batal' INTO v_active FROM public.booking_orders WHERE id = NEW.booking_order_id;
    IF COALESCE(v_active, false) THEN
      PERFORM public.adjust_sale_stock(NEW.product_id, NEW.quantity, NEW.product_name, -1);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_item_stock ON public.booking_order_items;
CREATE TRIGGER trg_pos_item_stock
AFTER INSERT OR UPDATE OF product_id, quantity, product_name OR DELETE ON public.booking_order_items
FOR EACH ROW EXECUTE FUNCTION public.apply_pos_item_stock();

CREATE OR REPLACE FUNCTION public.apply_pos_order_status_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it record; v_sign integer;
BEGIN
  IF (COALESCE(OLD.process_status, '') = 'batal') = (COALESCE(NEW.process_status, '') = 'batal') THEN
    RETURN NULL;
  END IF;
  v_sign := CASE WHEN COALESCE(NEW.process_status, '') = 'batal' THEN 1 ELSE -1 END;
  FOR it IN SELECT product_id, quantity, product_name FROM public.booking_order_items WHERE booking_order_id = NEW.id LOOP
    PERFORM public.adjust_sale_stock(it.product_id, it.quantity, it.product_name, v_sign);
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_order_status_stock ON public.booking_orders;
CREATE TRIGGER trg_pos_order_status_stock
AFTER UPDATE OF process_status ON public.booking_orders
FOR EACH ROW EXECUTE FUNCTION public.apply_pos_order_status_stock();

-- Booking products: deduct while the booking is not BATAL
CREATE OR REPLACE FUNCTION public.apply_booking_product_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_active boolean;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT COALESCE(status, '') <> 'BATAL' INTO v_active FROM public.bookings WHERE id = OLD.booking_id;
    IF COALESCE(v_active, false) THEN
      PERFORM public.adjust_sale_stock(OLD.product_id, OLD.quantity, OLD.product_name, 1);
    END IF;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT COALESCE(status, '') <> 'BATAL' INTO v_active FROM public.bookings WHERE id = NEW.booking_id;
    IF COALESCE(v_active, false) THEN
      PERFORM public.adjust_sale_stock(NEW.product_id, NEW.quantity, NEW.product_name, -1);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_product_stock ON public.booking_products;
CREATE TRIGGER trg_booking_product_stock
AFTER INSERT OR UPDATE OF product_id, quantity, product_name OR DELETE ON public.booking_products
FOR EACH ROW EXECUTE FUNCTION public.apply_booking_product_stock();

CREATE OR REPLACE FUNCTION public.apply_booking_status_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it record; v_sign integer;
BEGIN
  IF (COALESCE(OLD.status, '') = 'BATAL') = (COALESCE(NEW.status, '') = 'BATAL') THEN
    RETURN NULL;
  END IF;
  v_sign := CASE WHEN COALESCE(NEW.status, '') = 'BATAL' THEN 1 ELSE -1 END;
  FOR it IN SELECT product_id, quantity, product_name FROM public.booking_products WHERE booking_id = NEW.id LOOP
    PERFORM public.adjust_sale_stock(it.product_id, it.quantity, it.product_name, v_sign);
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_status_stock ON public.bookings;
CREATE TRIGGER trg_booking_status_stock
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.apply_booking_status_stock();

REVOKE EXECUTE ON FUNCTION public.adjust_sale_stock(uuid, numeric, text, integer) FROM PUBLIC, anon, authenticated;