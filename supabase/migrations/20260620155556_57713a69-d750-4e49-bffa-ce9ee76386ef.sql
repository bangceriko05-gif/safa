
-- 1. Link column
ALTER TABLE public.stock_in ADD COLUMN IF NOT EXISTS purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stock_in_purchase_id_unique ON public.stock_in(purchase_id) WHERE purchase_id IS NOT NULL;

-- 2. Function: sync stock_in from purchase receipt_status
CREATE OR REPLACE FUNCTION public.sync_stock_in_from_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_in_id uuid;
  v_creator uuid;
  v_item RECORD;
  v_total numeric := 0;
BEGIN
  -- Only act on changes to receipt_status or process_status
  IF TG_OP = 'UPDATE' AND NEW.receipt_status IS NOT DISTINCT FROM OLD.receipt_status
     AND NEW.process_status IS NOT DISTINCT FROM OLD.process_status THEN
    RETURN NEW;
  END IF;

  v_creator := COALESCE(NEW.received_by, NEW.created_by, NEW.posted_by);

  -- Cancellation: purchase was cancelled -> cancel linked stock_in
  IF NEW.process_status = 'batal' THEN
    UPDATE public.stock_in
       SET status = 'cancelled', cancelled_at = now(), cancelled_by = v_creator
     WHERE purchase_id = NEW.id AND status = 'posted';
    RETURN NEW;
  END IF;

  -- Receipt = Diterima: create or repost stock_in
  IF NEW.receipt_status = 'Diterima' THEN
    SELECT id INTO v_stock_in_id FROM public.stock_in WHERE purchase_id = NEW.id;

    IF v_stock_in_id IS NULL THEN
      -- compute total from purchase_items
      SELECT COALESCE(SUM(subtotal),0) INTO v_total FROM public.purchase_items WHERE purchase_id = NEW.id;

      INSERT INTO public.stock_in (store_id, date, supplier_name, notes, total_amount,
                                    status, posted_at, posted_by, created_by, purchase_id)
      VALUES (NEW.store_id, NEW.date, NEW.supplier_name,
              COALESCE('Auto dari pembelian ' || NEW.bid, 'Auto dari pembelian'),
              v_total, 'posted', now(), v_creator, COALESCE(v_creator, NEW.created_by), NEW.id)
      RETURNING id INTO v_stock_in_id;

      -- copy items
      FOR v_item IN SELECT * FROM public.purchase_items WHERE purchase_id = NEW.id LOOP
        INSERT INTO public.stock_in_items (stock_in_id, product_id, product_name, quantity, unit_price, subtotal)
        VALUES (v_stock_in_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, v_item.subtotal);
      END LOOP;
    ELSE
      -- if previously cancelled, repost (this triggers stock apply)
      UPDATE public.stock_in
         SET status = 'posted', posted_at = now(), posted_by = v_creator,
             cancelled_at = NULL, cancelled_by = NULL
       WHERE id = v_stock_in_id AND status <> 'posted';
    END IF;

  ELSE
    -- receipt_status changed away from Diterima -> cancel linked stock_in
    IF TG_OP = 'UPDATE' AND OLD.receipt_status = 'Diterima' AND NEW.receipt_status <> 'Diterima' THEN
      UPDATE public.stock_in
         SET status = 'cancelled', cancelled_at = now(), cancelled_by = v_creator
       WHERE purchase_id = NEW.id AND status = 'posted';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_stock_in_from_purchase ON public.purchases;
CREATE TRIGGER trg_sync_stock_in_from_purchase
AFTER INSERT OR UPDATE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.sync_stock_in_from_purchase();

-- 3. Backfill: any purchases already Diterima but missing stock_in
DO $$
DECLARE
  r RECORD;
  v_stock_in_id uuid;
  v_total numeric;
  v_item RECORD;
BEGIN
  FOR r IN
    SELECT p.* FROM public.purchases p
    LEFT JOIN public.stock_in si ON si.purchase_id = p.id
    WHERE p.receipt_status = 'Diterima'
      AND COALESCE(p.process_status,'') <> 'batal'
      AND si.id IS NULL
  LOOP
    SELECT COALESCE(SUM(subtotal),0) INTO v_total FROM public.purchase_items WHERE purchase_id = r.id;

    INSERT INTO public.stock_in (store_id, date, supplier_name, notes, total_amount,
                                  status, posted_at, posted_by, created_by, purchase_id)
    VALUES (r.store_id, r.date, r.supplier_name,
            COALESCE('Auto dari pembelian ' || r.bid, 'Auto dari pembelian'),
            v_total, 'posted', now(),
            COALESCE(r.received_by, r.created_by),
            COALESCE(r.created_by, r.received_by), r.id)
    RETURNING id INTO v_stock_in_id;

    FOR v_item IN SELECT * FROM public.purchase_items WHERE purchase_id = r.id LOOP
      INSERT INTO public.stock_in_items (stock_in_id, product_id, product_name, quantity, unit_price, subtotal)
      VALUES (v_stock_in_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, v_item.subtotal);
    END LOOP;
  END LOOP;
END;
$$;
