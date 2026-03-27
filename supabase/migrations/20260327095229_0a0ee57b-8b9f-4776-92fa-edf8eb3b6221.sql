
-- Create purchases table
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  bid text,
  supplier_name text NOT NULL DEFAULT '',
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'cash',
  payment_proof_url text,
  receipt_status text NOT NULL DEFAULT 'Belum Diterima',
  verification_status text NOT NULL DEFAULT 'Unverified',
  status text NOT NULL DEFAULT 'tunda',
  process_status text NOT NULL DEFAULT 'proses',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create purchase_items table
CREATE TABLE public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for purchases
CREATE POLICY "Users can view purchases in their stores"
ON public.purchases FOR SELECT TO authenticated
USING (public.has_store_access(auth.uid(), store_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can insert purchases in their stores"
ON public.purchases FOR INSERT TO authenticated
WITH CHECK (public.has_store_access(auth.uid(), store_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can update purchases in their stores"
ON public.purchases FOR UPDATE TO authenticated
USING (public.has_store_access(auth.uid(), store_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete purchases in their stores"
ON public.purchases FOR DELETE TO authenticated
USING (public.is_store_admin(auth.uid(), store_id) OR public.is_super_admin(auth.uid()));

-- RLS policies for purchase_items
CREATE POLICY "Users can view purchase items"
ON public.purchase_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.purchases p
  WHERE p.id = purchase_id
  AND (public.has_store_access(auth.uid(), p.store_id) OR public.is_super_admin(auth.uid()))
));

CREATE POLICY "Users can insert purchase items"
ON public.purchase_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.purchases p
  WHERE p.id = purchase_id
  AND (public.has_store_access(auth.uid(), p.store_id) OR public.is_super_admin(auth.uid()))
));

CREATE POLICY "Users can update purchase items"
ON public.purchase_items FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.purchases p
  WHERE p.id = purchase_id
  AND (public.has_store_access(auth.uid(), p.store_id) OR public.is_super_admin(auth.uid()))
));

CREATE POLICY "Users can delete purchase items"
ON public.purchase_items FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.purchases p
  WHERE p.id = purchase_id
  AND (public.has_store_access(auth.uid(), p.store_id) OR public.is_super_admin(auth.uid()))
));

-- BID generator for purchases
CREATE OR REPLACE FUNCTION public.generate_purchase_bid(purchase_date date, p_store_id uuid)
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
  date_str := to_char(purchase_date, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  bid_pattern := 'PO-' || store_code || '-' || date_str || '-%';

  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM 'PO-[A-Z]+-[0-9]{8}-([0-9]+)') AS integer)), 0) + 1
  INTO next_seq
  FROM purchases
  WHERE bid LIKE bid_pattern;

  new_bid := 'PO-' || store_code || '-' || date_str || '-' || LPAD(next_seq::text, 3, '0');
  RETURN new_bid;
END;
$$;

-- Auto-generate BID trigger
CREATE OR REPLACE FUNCTION public.auto_generate_purchase_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.bid IS NULL THEN
    NEW.bid := generate_purchase_bid(NEW.date, NEW.store_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_purchase_bid
BEFORE INSERT ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_purchase_bid();

-- Updated at trigger
CREATE TRIGGER trigger_update_purchases_updated_at
BEFORE UPDATE ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add feature key for existing stores
INSERT INTO public.store_features (store_id, feature_key, is_enabled)
SELECT id, 'transactions.purchases', true FROM public.stores
ON CONFLICT DO NOTHING;

-- Update auto_create_store_features to include purchases
CREATE OR REPLACE FUNCTION public.auto_create_store_features()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.store_features (store_id, feature_key, is_enabled)
  VALUES
    (NEW.id, 'calendar', true),
    (NEW.id, 'transactions', true),
    (NEW.id, 'customers', true),
    (NEW.id, 'reports', true),
    (NEW.id, 'settings', true),
    (NEW.id, 'products_inventory', true),
    (NEW.id, 'activity_log', true),
    (NEW.id, 'user_management', true),
    (NEW.id, 'booking_requests', true),
    (NEW.id, 'deposit', true),
    (NEW.id, 'transactions.list_booking', true),
    (NEW.id, 'transactions.expenses', true),
    (NEW.id, 'transactions.incomes', true),
    (NEW.id, 'transactions.deposits', true),
    (NEW.id, 'transactions.purchases', true),
    (NEW.id, 'reports.overview', true),
    (NEW.id, 'reports.sales', true),
    (NEW.id, 'reports.income_expense', true),
    (NEW.id, 'reports.purchase', true),
    (NEW.id, 'reports.employee', true),
    (NEW.id, 'reports.accounting', true),
    (NEW.id, 'settings.display', true),
    (NEW.id, 'settings.colors', true),
    (NEW.id, 'settings.notifications', true),
    (NEW.id, 'settings.print', true),
    (NEW.id, 'settings.rooms', true),
    (NEW.id, 'settings.outlet', true),
    (NEW.id, 'settings.ota', true),
    (NEW.id, 'products_inventory.rooms', true),
    (NEW.id, 'products_inventory.products', true),
    (NEW.id, 'products_inventory.categories', true);
  RETURN NEW;
END;
$function$;
