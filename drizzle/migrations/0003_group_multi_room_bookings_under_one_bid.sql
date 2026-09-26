CREATE TABLE public.booking_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid text UNIQUE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  booking_date date NOT NULL,
  is_ota boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_groups TO authenticated;
GRANT ALL ON public.booking_groups TO service_role;

ALTER TABLE public.booking_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view booking groups for accessible stores"
ON public.booking_groups FOR SELECT TO authenticated
USING (store_id = ANY (public.accessible_store_ids(auth.uid())));

CREATE POLICY "Users can create booking groups for accessible stores"
ON public.booking_groups FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND store_id = ANY (public.accessible_store_ids(auth.uid())));

CREATE POLICY "Users can update booking groups for accessible stores"
ON public.booking_groups FOR UPDATE TO authenticated
USING (store_id = ANY (public.accessible_store_ids(auth.uid())))
WITH CHECK (store_id = ANY (public.accessible_store_ids(auth.uid())));

CREATE POLICY "Users can delete booking groups for accessible stores"
ON public.booking_groups FOR DELETE TO authenticated
USING (store_id = ANY (public.accessible_store_ids(auth.uid())));

ALTER TABLE public.bookings ADD COLUMN booking_group_id uuid REFERENCES public.booking_groups(id) ON DELETE SET NULL;
CREATE INDEX idx_bookings_booking_group_id ON public.bookings(booking_group_id);

ALTER TABLE public.bookings DROP CONSTRAINT bookings_bid_key;
CREATE UNIQUE INDEX bookings_legacy_bid_key ON public.bookings(bid) WHERE booking_group_id IS NULL;

CREATE OR REPLACE FUNCTION public.generate_booking_bid(booking_date date, p_store_id uuid, is_ota boolean DEFAULT false)
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
  bid_prefix text;
  bid_pattern text;
BEGIN
  date_str := to_char(booking_date, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  bid_prefix := CASE WHEN is_ota THEN 'OTA' ELSE 'BO' END;
  bid_pattern := bid_prefix || '-' || store_code || '-' || date_str || '-%';

  SELECT COALESCE(MAX(sequence_no), 0) + 1
  INTO next_seq
  FROM (
    SELECT CAST(SUBSTRING(b.bid FROM bid_prefix || '-[A-Z]+-[0-9]{8}-([0-9]+)') AS integer) AS sequence_no
    FROM public.bookings b
    WHERE b.bid LIKE bid_pattern
    UNION ALL
    SELECT CAST(SUBSTRING(g.bid FROM bid_prefix || '-[A-Z]+-[0-9]{8}-([0-9]+)') AS integer) AS sequence_no
    FROM public.booking_groups g
    WHERE g.bid LIKE bid_pattern
  ) existing_bids;

  new_bid := bid_prefix || '-' || store_code || '-' || date_str || '-' || LPAD(next_seq::text, 3, '0');
  RETURN new_bid;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_generate_booking_group_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.bid IS NULL OR NEW.bid = '' OR
     (TG_OP = 'UPDATE' AND (NEW.booking_date IS DISTINCT FROM OLD.booking_date OR NEW.store_id IS DISTINCT FROM OLD.store_id OR NEW.is_ota IS DISTINCT FROM OLD.is_ota)) THEN
    NEW.bid := public.generate_booking_bid(NEW.booking_date, NEW.store_id, NEW.is_ota);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_booking_group_bid
BEFORE INSERT OR UPDATE OF booking_date, store_id, is_ota ON public.booking_groups
FOR EACH ROW EXECUTE FUNCTION public.auto_generate_booking_group_bid();

CREATE OR REPLACE FUNCTION public.auto_generate_booking_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.booking_group_id IS NOT NULL THEN
    SELECT bg.bid INTO NEW.bid
    FROM public.booking_groups bg
    WHERE bg.id = NEW.booking_group_id;
    IF NEW.bid IS NULL THEN
      RAISE EXCEPTION 'Booking group % tidak ditemukan atau belum memiliki BID', NEW.booking_group_id;
    END IF;
  ELSIF NEW.bid IS NULL THEN
    NEW.bid := public.generate_booking_bid(NEW.date, NEW.store_id, NEW.variant_id IS NULL);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON TABLE public.booking_groups IS 'Groups one or more room booking rows under a single customer-facing BID.';
COMMENT ON COLUMN public.bookings.booking_group_id IS 'Shared booking transaction that lets multiple room rows use one BID.';