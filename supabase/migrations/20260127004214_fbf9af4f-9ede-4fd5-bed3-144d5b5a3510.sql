-- Update the generate_booking_bid function to accept is_ota parameter
CREATE OR REPLACE FUNCTION public.generate_booking_bid(booking_date date, p_store_id uuid, is_ota boolean DEFAULT false) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
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
  
  -- Use OTA prefix for OTA bookings, BO for Walk-in
  IF is_ota THEN
    bid_prefix := 'OTA';
  ELSE
    bid_prefix := 'BO';
  END IF;
  
  bid_pattern := bid_prefix || '-' || store_code || '-' || date_str || '-%';
  
  -- Build regex pattern based on prefix
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM bid_prefix || '-[A-Z]+-[0-9]{8}-([0-9]+)') AS integer)), 0) + 1
  INTO next_seq
  FROM bookings
  WHERE bid LIKE bid_pattern;
  
  new_bid := bid_prefix || '-' || store_code || '-' || date_str || '-' || LPAD(next_seq::text, 3, '0');
  
  RETURN new_bid;
END;
$$;

-- Update the trigger function to check variant_id for OTA detection
CREATE OR REPLACE FUNCTION public.auto_generate_booking_bid() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.bid IS NULL THEN
    -- If variant_id is NULL, it's an OTA booking
    NEW.bid := generate_booking_bid(NEW.date, NEW.store_id, NEW.variant_id IS NULL);
  END IF;
  RETURN NEW;
END;
$$;