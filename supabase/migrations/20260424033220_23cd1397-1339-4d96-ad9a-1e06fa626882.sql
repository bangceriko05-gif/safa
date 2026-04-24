-- Stock Out (pengeluaran stok)
CREATE TABLE IF NOT EXISTS public.stock_out (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  bid text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  reason text,                -- alasan pengeluaran (operasional, rusak, dll)
  recipient text,             -- penerima/tujuan
  notes text,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  posted_at timestamptz,
  posted_by uuid,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_out_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_out_id uuid NOT NULL REFERENCES public.stock_out(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text NOT NULL,
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_out_store ON public.stock_out(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_out_items_stock ON public.stock_out_items(stock_out_id);

-- RLS
ALTER TABLE public.stock_out ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_out_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stock_out in their stores"
  ON public.stock_out FOR SELECT
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Users can insert stock_out in their stores"
  ON public.stock_out FOR INSERT
  WITH CHECK (auth.uid() = created_by AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

CREATE POLICY "Admins can update stock_out"
  ON public.stock_out FOR UPDATE
  USING (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id) OR (status = 'draft' AND auth.uid() = created_by));

CREATE POLICY "Admins can delete stock_out"
  ON public.stock_out FOR DELETE
  USING (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id));

CREATE POLICY "Akuntan and super admin can delete stock_out"
  ON public.stock_out FOR DELETE
  USING (is_super_admin(auth.uid()) OR (has_any_role(auth.uid(), ARRAY['akuntan'::app_role]) AND has_store_access(auth.uid(), store_id)));

CREATE POLICY "Users can view stock_out_items in their stores"
  ON public.stock_out_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM stock_out so WHERE so.id = stock_out_items.stock_out_id AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), so.store_id))));

CREATE POLICY "Users can insert stock_out_items"
  ON public.stock_out_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM stock_out so WHERE so.id = stock_out_items.stock_out_id AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), so.store_id))));

CREATE POLICY "Users can update stock_out_items"
  ON public.stock_out_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM stock_out so WHERE so.id = stock_out_items.stock_out_id AND so.status = 'draft' AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), so.store_id))));

CREATE POLICY "Users can delete stock_out_items"
  ON public.stock_out_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM stock_out so WHERE so.id = stock_out_items.stock_out_id AND so.status = 'draft' AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), so.store_id))));

CREATE POLICY "Akuntan and super admin can delete stock_out_items"
  ON public.stock_out_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM stock_out so WHERE so.id = stock_out_items.stock_out_id AND (is_super_admin(auth.uid()) OR (has_any_role(auth.uid(), ARRAY['akuntan'::app_role]) AND has_store_access(auth.uid(), so.store_id)))));

-- BID generator: OUT + DDMMYY + 8-digit seq, scoped per store
CREATE OR REPLACE FUNCTION public.generate_stock_out_bid(p_date date, p_store_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  date_str text;
  next_seq integer;
  new_bid text;
  bid_pattern text;
BEGIN
  date_str := to_char(p_date, 'DDMMYY');
  bid_pattern := 'OUT' || date_str || '%';
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM 'OUT[0-9]{6}([0-9]+)') AS integer)), 0) + 1
  INTO next_seq
  FROM public.stock_out
  WHERE bid LIKE bid_pattern AND store_id = p_store_id;
  new_bid := 'OUT' || date_str || LPAD(next_seq::text, 8, '0');
  RETURN new_bid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_generate_stock_out_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.bid IS NULL OR NEW.bid = '' THEN
    NEW.bid := public.generate_stock_out_bid(NEW.date, NEW.store_id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_stock_out_bid
BEFORE INSERT ON public.stock_out
FOR EACH ROW EXECUTE FUNCTION public.auto_generate_stock_out_bid();

CREATE TRIGGER trg_stock_out_updated_at
BEFORE UPDATE ON public.stock_out
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Apply / revert stock when posting / cancelling
CREATE OR REPLACE FUNCTION public.apply_stock_out_to_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- anything -> posted: subtract stock
  IF NEW.status = 'posted' AND (OLD.status IS DISTINCT FROM 'posted') THEN
    UPDATE public.products p
    SET stock_qty = p.stock_qty - soi.quantity
    FROM public.stock_out_items soi
    WHERE soi.stock_out_id = NEW.id AND soi.product_id = p.id;
  END IF;

  -- posted -> cancelled: revert (add back)
  IF NEW.status = 'cancelled' AND OLD.status = 'posted' THEN
    UPDATE public.products p
    SET stock_qty = p.stock_qty + soi.quantity
    FROM public.stock_out_items soi
    WHERE soi.stock_out_id = NEW.id AND soi.product_id = p.id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_stock_out_apply
AFTER UPDATE ON public.stock_out
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_out_to_products();