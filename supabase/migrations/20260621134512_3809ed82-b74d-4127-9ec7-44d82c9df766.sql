CREATE OR REPLACE FUNCTION public.sync_stock_in_from_purchase()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stock_in_id uuid;
  v_creator uuid;
  v_item RECORD;
  v_total numeric := 0;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.receipt_status IS NOT DISTINCT FROM OLD.receipt_status
     AND NEW.process_status IS NOT DISTINCT FROM OLD.process_status THEN
    RETURN NEW;
  END IF;

  v_creator := COALESCE(NEW.received_by, NEW.created_by, NEW.posted_by);

  IF NEW.process_status = 'batal' THEN
    UPDATE public.stock_in
       SET status = 'cancelled', cancelled_at = now(), cancelled_by = v_creator
     WHERE purchase_id = NEW.id AND status = 'posted';
    RETURN NEW;
  END IF;

  IF NEW.receipt_status = 'Diterima' THEN
    SELECT id INTO v_stock_in_id FROM public.stock_in WHERE purchase_id = NEW.id;

    IF v_stock_in_id IS NULL THEN
      SELECT COALESCE(SUM(subtotal),0) INTO v_total FROM public.purchase_items WHERE purchase_id = NEW.id;

      -- Create as DRAFT only. Do NOT auto-post. The user will post it from Stok Masuk.
      INSERT INTO public.stock_in (store_id, date, supplier_name, notes, total_amount,
                                    status, created_by, purchase_id)
      VALUES (NEW.store_id, NEW.date, NEW.supplier_name,
              COALESCE('Auto dari pembelian ' || NEW.bid, 'Auto dari pembelian'),
              v_total, 'draft', COALESCE(v_creator, NEW.created_by), NEW.id)
      RETURNING id INTO v_stock_in_id;

      FOR v_item IN SELECT * FROM public.purchase_items WHERE purchase_id = NEW.id LOOP
        INSERT INTO public.stock_in_items (stock_in_id, product_id, product_name, quantity, unit_price, subtotal)
        VALUES (v_stock_in_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, v_item.subtotal);
      END LOOP;
    ELSE
      -- If previously cancelled, revert to draft (still NOT auto-post)
      UPDATE public.stock_in
         SET status = 'draft', cancelled_at = NULL, cancelled_by = NULL
       WHERE id = v_stock_in_id AND status = 'cancelled';
    END IF;

  ELSE
    IF TG_OP = 'UPDATE' AND OLD.receipt_status = 'Diterima' AND NEW.receipt_status <> 'Diterima' THEN
      UPDATE public.stock_in
         SET status = 'cancelled', cancelled_at = now(), cancelled_by = v_creator
       WHERE purchase_id = NEW.id AND status = 'posted';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;