
-- BOOKING (2-arg legacy, still BO prefix)
CREATE OR REPLACE FUNCTION public.generate_booking_bid(booking_date date, p_store_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE date_str text; store_code text; next_seq integer; new_bid text;
BEGIN
  date_str := to_char(booking_date, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM '^BO-?' || store_code || '-?' || date_str || '-?([0-9]+)$') AS integer)), 0) + 1
    INTO next_seq FROM bookings
    WHERE bid ~ ('^BO-?' || store_code || '-?' || date_str || '-?[0-9]+$');
  new_bid := 'BO' || store_code || date_str || LPAD(next_seq::text, 3, '0');
  RETURN new_bid;
END;
$function$;

-- BOOKING (3-arg w/ OTA flag)
CREATE OR REPLACE FUNCTION public.generate_booking_bid(booking_date date, p_store_id uuid, is_ota boolean DEFAULT false)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE date_str text; store_code text; next_seq integer; new_bid text; bid_prefix text;
BEGIN
  date_str := to_char(booking_date, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  bid_prefix := CASE WHEN is_ota THEN 'OTA' ELSE 'BO' END;
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM '^' || bid_prefix || '-?' || store_code || '-?' || date_str || '-?([0-9]+)$') AS integer)), 0) + 1
    INTO next_seq FROM bookings
    WHERE bid ~ ('^' || bid_prefix || '-?' || store_code || '-?' || date_str || '-?[0-9]+$');
  new_bid := bid_prefix || store_code || date_str || LPAD(next_seq::text, 3, '0');
  RETURN new_bid;
END;
$function$;

-- BOOKING ORDER (FB)
CREATE OR REPLACE FUNCTION public.generate_booking_order_bid(p_date date, p_store_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE date_str text; store_code text; next_seq integer; new_bid text;
BEGIN
  date_str := to_char(p_date, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM '^FB-?' || store_code || '-?' || date_str || '-?([0-9]+)$') AS integer)), 0) + 1
    INTO next_seq FROM public.booking_orders
    WHERE bid ~ ('^FB-?' || store_code || '-?' || date_str || '-?[0-9]+$');
  new_bid := 'FB' || store_code || date_str || LPAD(next_seq::text, 3, '0');
  RETURN new_bid;
END;
$function$;

-- BOOKING REQUEST (BR)
CREATE OR REPLACE FUNCTION public.generate_booking_request_bid(request_date date, p_store_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE date_str text; store_code text; next_seq integer; new_bid text;
BEGIN
  date_str := to_char(request_date, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM '^BR-?' || store_code || '-?' || date_str || '-?([0-9]+)$') AS integer)), 0) + 1
    INTO next_seq FROM booking_requests
    WHERE bid ~ ('^BR-?' || store_code || '-?' || date_str || '-?[0-9]+$');
  new_bid := 'BR' || store_code || date_str || LPAD(next_seq::text, 3, '0');
  RETURN new_bid;
END;
$function$;

-- EXPENSE (OU)
CREATE OR REPLACE FUNCTION public.generate_expense_bid(expense_date date, p_store_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE date_str text; store_code text; next_seq integer; new_bid text;
BEGIN
  date_str := to_char(expense_date, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM '^OU-?' || store_code || '-?' || date_str || '-?([0-9]+)$') AS integer)), 0) + 1
    INTO next_seq FROM expenses
    WHERE bid ~ ('^OU-?' || store_code || '-?' || date_str || '-?[0-9]+$');
  new_bid := 'OU' || store_code || date_str || LPAD(next_seq::text, 3, '0');
  RETURN new_bid;
END;
$function$;

-- INCOME (IN)
CREATE OR REPLACE FUNCTION public.generate_income_bid(income_date date, p_store_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE date_str text; store_code text; next_seq integer; new_bid text;
BEGIN
  date_str := to_char(income_date, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM '^IN-?' || store_code || '-?' || date_str || '-?([0-9]+)$') AS integer)), 0) + 1
    INTO next_seq FROM incomes
    WHERE bid ~ ('^IN-?' || store_code || '-?' || date_str || '-?[0-9]+$');
  new_bid := 'IN' || store_code || date_str || LPAD(next_seq::text, 3, '0');
  RETURN new_bid;
END;
$function$;

-- PURCHASE (PO)
CREATE OR REPLACE FUNCTION public.generate_purchase_bid(purchase_date date, p_store_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE date_str text; store_code text; next_seq integer; new_bid text;
BEGIN
  date_str := to_char(purchase_date, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM '^PO-?' || store_code || '-?' || date_str || '-?([0-9]+)$') AS integer)), 0) + 1
    INTO next_seq FROM purchases
    WHERE bid ~ ('^PO-?' || store_code || '-?' || date_str || '-?[0-9]+$');
  new_bid := 'PO' || store_code || date_str || LPAD(next_seq::text, 3, '0');
  RETURN new_bid;
END;
$function$;

-- ASSET (AS)
CREATE OR REPLACE FUNCTION public.generate_asset_bid(p_store_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE date_str text; store_code text; next_seq integer; new_bid text;
BEGIN
  date_str := to_char(CURRENT_DATE, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM '^AS-?' || store_code || '-?' || date_str || '-?([0-9]+)$') AS integer)), 0) + 1
    INTO next_seq FROM assets
    WHERE bid ~ ('^AS-?' || store_code || '-?' || date_str || '-?[0-9]+$');
  new_bid := 'AS' || store_code || date_str || LPAD(next_seq::text, 3, '0');
  RETURN new_bid;
END;
$function$;

-- STOCK IN: existing prod uses 'PO-STR-...' pattern per UI; keep PO prefix + store_code variant
CREATE OR REPLACE FUNCTION public.generate_stock_in_bid(p_date date, p_store_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE date_str text; store_code text; next_seq integer; new_bid text;
BEGIN
  date_str := to_char(p_date, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM '^PO-?' || store_code || '-?' || date_str || '-?([0-9]+)$') AS integer)), 0) + 1
    INTO next_seq FROM public.stock_in
    WHERE store_id = p_store_id
      AND bid ~ ('^PO-?' || store_code || '-?' || date_str || '-?[0-9]+$');
  new_bid := 'PO' || store_code || date_str || LPAD(next_seq::text, 3, '0');
  RETURN new_bid;
END;
$function$;

-- STOCK OUT (OUT prefix + store_code + date)
CREATE OR REPLACE FUNCTION public.generate_stock_out_bid(p_date date, p_store_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE date_str text; store_code text; next_seq integer; new_bid text;
BEGIN
  date_str := to_char(p_date, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM '^OUT-?' || store_code || '-?' || date_str || '-?([0-9]+)$') AS integer)), 0) + 1
    INTO next_seq FROM public.stock_out
    WHERE store_id = p_store_id
      AND bid ~ ('^OUT-?' || store_code || '-?' || date_str || '-?[0-9]+$');
  new_bid := 'OUT' || store_code || date_str || LPAD(next_seq::text, 3, '0');
  RETURN new_bid;
END;
$function$;

-- STOCK OPNAME (OP)
CREATE OR REPLACE FUNCTION public.generate_stock_opname_bid(p_date date, p_store_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE date_str text; store_code text; next_seq integer; new_bid text;
BEGIN
  date_str := to_char(p_date, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM '^OP-?' || store_code || '-?' || date_str || '-?([0-9]+)$') AS integer)), 0) + 1
    INTO next_seq FROM public.stock_opname
    WHERE store_id = p_store_id
      AND bid ~ ('^OP-?' || store_code || '-?' || date_str || '-?[0-9]+$');
  new_bid := 'OP' || store_code || date_str || LPAD(next_seq::text, 4, '0');
  RETURN new_bid;
END;
$function$;
