-- Add stock_qty to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_qty numeric NOT NULL DEFAULT 0;

-- SUPPLIERS
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view suppliers in their stores"
ON public.suppliers FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Users can insert suppliers in their stores"
ON public.suppliers FOR INSERT TO authenticated
WITH CHECK ((auth.uid() = created_by) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

CREATE POLICY "Admins can update suppliers"
ON public.suppliers FOR UPDATE TO authenticated
USING (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id));

CREATE POLICY "Admins can delete suppliers"
ON public.suppliers FOR DELETE TO authenticated
USING (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id));

CREATE TRIGGER suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- STOCK_IN
CREATE TABLE IF NOT EXISTS public.stock_in (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  bid text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  supplier_id uuid,
  supplier_name text,
  notes text,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft', -- draft | posted | cancelled
  posted_at timestamptz,
  posted_by uuid,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_in ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stock_in in their stores"
ON public.stock_in FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Users can insert stock_in in their stores"
ON public.stock_in FOR INSERT TO authenticated
WITH CHECK ((auth.uid() = created_by) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

CREATE POLICY "Admins can update stock_in"
ON public.stock_in FOR UPDATE TO authenticated
USING (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id) OR (status = 'draft' AND auth.uid() = created_by));

CREATE POLICY "Admins can delete stock_in"
ON public.stock_in FOR DELETE TO authenticated
USING (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id));

CREATE TRIGGER stock_in_updated_at
BEFORE UPDATE ON public.stock_in
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- STOCK_IN_ITEMS
CREATE TABLE IF NOT EXISTS public.stock_in_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_in_id uuid NOT NULL REFERENCES public.stock_in(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_in_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stock_in_items in their stores"
ON public.stock_in_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.stock_in si WHERE si.id = stock_in_items.stock_in_id AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), si.store_id))));

CREATE POLICY "Users can insert stock_in_items"
ON public.stock_in_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.stock_in si WHERE si.id = stock_in_items.stock_in_id AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), si.store_id))));

CREATE POLICY "Users can update stock_in_items"
ON public.stock_in_items FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.stock_in si WHERE si.id = stock_in_items.stock_in_id AND si.status = 'draft' AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), si.store_id))));

CREATE POLICY "Users can delete stock_in_items"
ON public.stock_in_items FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.stock_in si WHERE si.id = stock_in_items.stock_in_id AND si.status = 'draft' AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), si.store_id))));

-- Generate stock_in BID: IN<DDMMYY><HHMMSS><NN>
CREATE OR REPLACE FUNCTION public.generate_stock_in_bid(p_date date, p_store_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  date_str text;
  next_seq integer;
  new_bid text;
  bid_pattern text;
BEGIN
  date_str := to_char(p_date, 'DDMMYY');
  bid_pattern := 'IN' || date_str || '%';

  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM 'IN[0-9]{6}([0-9]+)') AS integer)), 0) + 1
  INTO next_seq
  FROM public.stock_in
  WHERE bid LIKE bid_pattern AND store_id = p_store_id;

  new_bid := 'IN' || date_str || LPAD(next_seq::text, 8, '0');
  RETURN new_bid;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_generate_stock_in_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.bid IS NULL OR NEW.bid = '' THEN
    NEW.bid := public.generate_stock_in_bid(NEW.date, NEW.store_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER stock_in_set_bid
BEFORE INSERT ON public.stock_in
FOR EACH ROW EXECUTE FUNCTION public.auto_generate_stock_in_bid();

-- Auto adjust product stock when stock_in is posted/cancelled
CREATE OR REPLACE FUNCTION public.apply_stock_in_to_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Transition: anything -> posted (and was not posted before)
  IF NEW.status = 'posted' AND (OLD.status IS DISTINCT FROM 'posted') THEN
    UPDATE public.products p
    SET stock_qty = p.stock_qty + sii.quantity
    FROM public.stock_in_items sii
    WHERE sii.stock_in_id = NEW.id AND sii.product_id = p.id;
  END IF;

  -- Transition: posted -> cancelled (revert stock)
  IF NEW.status = 'cancelled' AND OLD.status = 'posted' THEN
    UPDATE public.products p
    SET stock_qty = p.stock_qty - sii.quantity
    FROM public.stock_in_items sii
    WHERE sii.stock_in_id = NEW.id AND sii.product_id = p.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER stock_in_apply_to_stock
AFTER UPDATE OF status ON public.stock_in
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_in_to_products();