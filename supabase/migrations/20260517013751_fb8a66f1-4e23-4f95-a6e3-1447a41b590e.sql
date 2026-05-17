-- booking_orders table
CREATE TABLE public.booking_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  bid text UNIQUE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  reference_no text,
  payment_method_2 text,
  reference_no_2 text,
  dual_payment boolean NOT NULL DEFAULT false,
  amount numeric NOT NULL DEFAULT 0,
  amount_2 numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'belum_lunas',
  payment_proof_urls text[] NOT NULL DEFAULT '{}',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_orders_booking_id ON public.booking_orders(booking_id);
CREATE INDEX idx_booking_orders_store_id ON public.booking_orders(store_id);

-- booking_order_items table
CREATE TABLE public.booking_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_order_id uuid NOT NULL REFERENCES public.booking_orders(id) ON DELETE CASCADE,
  product_id uuid,
  product_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_order_items_order_id ON public.booking_order_items(booking_order_id);

-- BID generator
CREATE OR REPLACE FUNCTION public.generate_booking_order_bid(p_date date, p_store_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  date_str text;
  store_code text;
  next_seq integer;
  new_bid text;
  bid_pattern text;
BEGIN
  date_str := to_char(p_date, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  bid_pattern := 'FB-' || store_code || '-' || date_str || '-%';

  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM 'FB-[A-Z]+-[0-9]{8}-([0-9]+)') AS integer)), 0) + 1
  INTO next_seq
  FROM public.booking_orders
  WHERE bid LIKE bid_pattern;

  new_bid := 'FB-' || store_code || '-' || date_str || '-' || LPAD(next_seq::text, 3, '0');
  RETURN new_bid;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_generate_booking_order_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.bid IS NULL OR NEW.bid = '' THEN
    NEW.bid := public.generate_booking_order_bid(NEW.date, NEW.store_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_generate_booking_order_bid
BEFORE INSERT ON public.booking_orders
FOR EACH ROW EXECUTE FUNCTION public.auto_generate_booking_order_bid();

CREATE TRIGGER trg_update_booking_orders_updated_at
BEFORE UPDATE ON public.booking_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.booking_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_order_items ENABLE ROW LEVEL SECURITY;

-- RLS booking_orders
CREATE POLICY "Store members can view booking orders"
ON public.booking_orders FOR SELECT
USING (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));

CREATE POLICY "Store members can create booking orders"
ON public.booking_orders FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));

CREATE POLICY "Store members can update booking orders"
ON public.booking_orders FOR UPDATE
USING (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));

CREATE POLICY "Store members can delete booking orders"
ON public.booking_orders FOR DELETE
USING (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));

-- RLS booking_order_items
CREATE POLICY "Store members can view booking order items"
ON public.booking_order_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.booking_orders bo
  WHERE bo.id = booking_order_id
    AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), bo.store_id))
));

CREATE POLICY "Store members can insert booking order items"
ON public.booking_order_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.booking_orders bo
  WHERE bo.id = booking_order_id
    AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), bo.store_id))
));

CREATE POLICY "Store members can update booking order items"
ON public.booking_order_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.booking_orders bo
  WHERE bo.id = booking_order_id
    AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), bo.store_id))
));

CREATE POLICY "Store members can delete booking order items"
ON public.booking_order_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.booking_orders bo
  WHERE bo.id = booking_order_id
    AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), bo.store_id))
));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_order_items;
