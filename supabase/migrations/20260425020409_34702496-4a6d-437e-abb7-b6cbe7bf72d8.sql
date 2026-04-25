-- Stock Opname (perhitungan fisik stok)
CREATE TABLE IF NOT EXISTS public.stock_opname (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  bid text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  total_difference numeric NOT NULL DEFAULT 0,
  total_value_difference numeric NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS public.stock_opname_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_opname_id uuid NOT NULL REFERENCES public.stock_opname(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text NOT NULL,
  system_stock numeric NOT NULL DEFAULT 0,
  actual_stock numeric NOT NULL DEFAULT 0,
  difference numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  value_difference numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_opname_store ON public.stock_opname(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_opname_items_so ON public.stock_opname_items(stock_opname_id);

ALTER TABLE public.stock_opname ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stock_opname in their stores"
  ON public.stock_opname FOR SELECT
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Users can insert stock_opname in their stores"
  ON public.stock_opname FOR INSERT
  WITH CHECK (auth.uid() = created_by AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

CREATE POLICY "Admins can update stock_opname"
  ON public.stock_opname FOR UPDATE
  USING (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id) OR (status = 'draft' AND auth.uid() = created_by));

CREATE POLICY "Admins can delete stock_opname"
  ON public.stock_opname FOR DELETE
  USING (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id));

CREATE POLICY "Akuntan and super admin can delete stock_opname"
  ON public.stock_opname FOR DELETE
  USING (is_super_admin(auth.uid()) OR (has_any_role(auth.uid(), ARRAY['akuntan'::app_role]) AND has_store_access(auth.uid(), store_id)));

CREATE POLICY "Users can view stock_opname_items in their stores"
  ON public.stock_opname_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM stock_opname so WHERE so.id = stock_opname_items.stock_opname_id AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), so.store_id))));

CREATE POLICY "Users can insert stock_opname_items"
  ON public.stock_opname_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM stock_opname so WHERE so.id = stock_opname_items.stock_opname_id AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), so.store_id))));

CREATE POLICY "Users can update stock_opname_items"
  ON public.stock_opname_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM stock_opname so WHERE so.id = stock_opname_items.stock_opname_id AND so.status = 'draft' AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), so.store_id))));

CREATE POLICY "Users can delete stock_opname_items"
  ON public.stock_opname_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM stock_opname so WHERE so.id = stock_opname_items.stock_opname_id AND so.status = 'draft' AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), so.store_id))));

CREATE POLICY "Akuntan and super admin can delete stock_opname_items"
  ON public.stock_opname_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM stock_opname so WHERE so.id = stock_opname_items.stock_opname_id AND (is_super_admin(auth.uid()) OR (has_any_role(auth.uid(), ARRAY['akuntan'::app_role]) AND has_store_access(auth.uid(), so.store_id)))));

CREATE TRIGGER trg_stock_opname_updated_at
BEFORE UPDATE ON public.stock_opname
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BID generator: OP-YYYYMMDD-#### scoped per store/day
CREATE OR REPLACE FUNCTION public.generate_stock_opname_bid(p_date date, p_store_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  date_str text;
  next_seq integer;
  new_bid text;
BEGIN
  date_str := to_char(p_date, 'YYYYMMDD');
  SELECT COALESCE(MAX((regexp_match(bid, 'OP-' || date_str || '-(\d+)$'))[1]::integer), 0) + 1
  INTO next_seq
  FROM public.stock_opname
  WHERE store_id = p_store_id AND bid LIKE 'OP-' || date_str || '-%';
  new_bid := 'OP-' || date_str || '-' || lpad(next_seq::text, 4, '0');
  RETURN new_bid;
END;
$function$;

-- Apply opname on post: set products.stock_qty to actual_stock; on cancel revert to system_stock
CREATE OR REPLACE FUNCTION public.apply_stock_opname_to_products()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'posted' AND (OLD.status IS DISTINCT FROM 'posted') THEN
    UPDATE public.products p
    SET stock_qty = soi.actual_stock,
        updated_at = now()
    FROM public.stock_opname_items soi
    WHERE soi.stock_opname_id = NEW.id AND soi.product_id = p.id;
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'posted' THEN
    UPDATE public.products p
    SET stock_qty = soi.system_stock,
        updated_at = now()
    FROM public.stock_opname_items soi
    WHERE soi.stock_opname_id = NEW.id AND soi.product_id = p.id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_apply_stock_opname
AFTER UPDATE ON public.stock_opname
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_opname_to_products();