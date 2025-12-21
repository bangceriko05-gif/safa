CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user',
    'leader'
);


--
-- Name: auto_assign_role_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_assign_role_permissions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Insert permissions for the user based on their role
  INSERT INTO public.user_permissions (user_id, permission_id, granted_by)
  SELECT 
    NEW.user_id,
    rp.permission_id,
    NEW.user_id -- self-granted through role assignment
  FROM public.role_permissions rp
  WHERE rp.role = NEW.role
  ON CONFLICT DO NOTHING; -- Skip if permission already exists
  
  RETURN NEW;
END;
$$;


--
-- Name: auto_generate_booking_bid(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_generate_booking_bid() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.bid IS NULL THEN
    NEW.bid := generate_booking_bid(NEW.date, NEW.store_id);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: auto_generate_booking_request_bid(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_generate_booking_request_bid() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.bid IS NULL THEN
    NEW.bid := generate_booking_request_bid(NEW.booking_date, NEW.store_id);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: auto_generate_confirmation_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_generate_confirmation_token() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.confirmation_token IS NULL THEN
    NEW.confirmation_token := generate_confirmation_token();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: auto_generate_expense_bid(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_generate_expense_bid() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.bid IS NULL THEN
    NEW.bid := generate_expense_bid(NEW.date, NEW.store_id);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: auto_generate_income_bid(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_generate_income_bid() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.bid IS NULL THEN
    NEW.bid := generate_income_bid(NEW.date, NEW.store_id);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: check_and_expire_booking_request(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_and_expire_booking_request(p_request_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_request record;
BEGIN
  SELECT * INTO v_request
  FROM booking_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if expired
  IF v_request.expired_at IS NOT NULL 
     AND v_request.expired_at < NOW() 
     AND v_request.status = 'pending'
     AND v_request.payment_proof_url IS NULL THEN
    -- Auto-expire the booking
    UPDATE booking_requests
    SET status = 'expired',
        admin_notes = COALESCE(admin_notes || E'\n', '') || 'Otomatis dibatalkan: waktu pembayaran habis'
    WHERE id = p_request_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


--
-- Name: check_booking_rate_limit(text, integer, interval); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_booking_rate_limit(p_phone text, p_max_requests integer DEFAULT 5, p_time_window interval DEFAULT '01:00:00'::interval) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM booking_requests
  WHERE customer_phone = p_phone
    AND created_at > NOW() - p_time_window;
  
  RETURN v_count < p_max_requests;
END;
$$;


--
-- Name: checkout_booking_by_request_id(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.checkout_booking_by_request_id(p_request_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_request record;
  v_booking_id uuid;
BEGIN
  -- Get request data
  SELECT * INTO v_request
  FROM booking_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking request not found';
  END IF;

  -- Find the booking
  SELECT id INTO v_booking_id
  FROM bookings
  WHERE room_id = v_request.room_id
  AND date = v_request.booking_date
  AND start_time = v_request.start_time
  AND store_id = v_request.store_id
  AND status = 'CI'
  LIMIT 1;

  IF v_booking_id IS NOT NULL THEN
    -- Update booking status to checkout
    UPDATE bookings
    SET status = 'CO',
        checked_out_by = p_user_id,
        checked_out_at = now()
    WHERE id = v_booking_id;
  END IF;

  -- DO NOT change room status - room availability is determined by bookings
END;
$$;


--
-- Name: checkout_booking_from_request(record, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.checkout_booking_from_request(p_request record, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_booking_id uuid;
BEGIN
  -- Find the booking
  SELECT id INTO v_booking_id
  FROM bookings
  WHERE room_id = p_request.room_id
  AND date = p_request.booking_date
  AND start_time = p_request.start_time
  AND store_id = p_request.store_id
  AND status = 'CI'
  LIMIT 1;

  IF v_booking_id IS NOT NULL THEN
    -- Update booking status to checkout
    UPDATE bookings
    SET status = 'CO',
        checked_out_by = p_user_id,
        checked_out_at = now()
    WHERE id = v_booking_id;
  END IF;

  -- Update room status to available
  UPDATE rooms
  SET status = 'Aktif'
  WHERE id = p_request.room_id;
END;
$$;


--
-- Name: create_booking_from_request(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_booking_from_request(p_request_id uuid, p_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_request record;
  v_customer_id uuid;
  v_booking_id uuid;
BEGIN
  -- Get booking request data
  SELECT * INTO v_request
  FROM booking_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking request not found';
  END IF;

  -- Check if there's already a booking for this room at the same time
  IF EXISTS (
    SELECT 1 FROM bookings 
    WHERE room_id = v_request.room_id 
    AND date = v_request.booking_date
    AND status IN ('BO', 'CI')
    AND (
      (start_time <= v_request.start_time AND end_time > v_request.start_time)
      OR (start_time < v_request.end_time AND end_time >= v_request.end_time)
      OR (start_time >= v_request.start_time AND end_time <= v_request.end_time)
    )
  ) THEN
    RAISE EXCEPTION 'Room is already booked for this time slot';
  END IF;

  -- Find or create customer
  v_customer_id := v_request.customer_id;
  
  IF v_customer_id IS NULL THEN
    -- Check if customer exists by phone
    SELECT id INTO v_customer_id
    FROM customers
    WHERE phone = v_request.customer_phone
    AND store_id = v_request.store_id
    LIMIT 1;

    IF v_customer_id IS NULL THEN
      -- Create new customer
      INSERT INTO customers (name, phone, store_id, created_by)
      VALUES (v_request.customer_name, v_request.customer_phone, v_request.store_id, p_user_id)
      RETURNING id INTO v_customer_id;
    END IF;

    -- Update booking request with customer_id
    UPDATE booking_requests
    SET customer_id = v_customer_id
    WHERE id = p_request_id;
  END IF;

  -- Create booking record
  INSERT INTO bookings (
    room_id,
    store_id,
    date,
    start_time,
    end_time,
    duration,
    price,
    customer_name,
    phone,
    payment_method,
    reference_no,
    status,
    created_by,
    checked_in_by,
    checked_in_at
  ) VALUES (
    v_request.room_id,
    v_request.store_id,
    v_request.booking_date,
    v_request.start_time,
    v_request.end_time,
    v_request.duration,
    v_request.total_price,
    v_request.customer_name,
    v_request.customer_phone,
    v_request.payment_method,
    COALESCE(v_request.payment_proof_url, '-'),
    'CI',
    p_user_id,
    p_user_id,
    now()
  )
  RETURNING id INTO v_booking_id;

  -- DO NOT change room status - availability is determined by bookings data
  -- Room stays 'Aktif' and schedule table shows occupied slots based on booking times

  RETURN v_booking_id;
END;
$$;


--
-- Name: create_booking_from_request(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_booking_from_request(p_request_id uuid, p_user_id uuid, p_status text DEFAULT 'CI'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_request record;
  v_customer_id uuid;
  v_booking_id uuid;
BEGIN
  -- Get booking request data
  SELECT * INTO v_request
  FROM booking_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking request not found';
  END IF;

  -- Check if there's already a booking for this room at the same time
  IF EXISTS (
    SELECT 1 FROM bookings 
    WHERE room_id = v_request.room_id 
    AND date = v_request.booking_date
    AND status IN ('BO', 'CI')
    AND (
      (start_time <= v_request.start_time AND end_time > v_request.start_time)
      OR (start_time < v_request.end_time AND end_time >= v_request.end_time)
      OR (start_time >= v_request.start_time AND end_time <= v_request.end_time)
    )
  ) THEN
    RAISE EXCEPTION 'Room is already booked for this time slot';
  END IF;

  -- Find or create customer
  v_customer_id := v_request.customer_id;
  
  IF v_customer_id IS NULL THEN
    -- Check if customer exists by phone
    SELECT id INTO v_customer_id
    FROM customers
    WHERE phone = v_request.customer_phone
    AND store_id = v_request.store_id
    LIMIT 1;

    IF v_customer_id IS NULL THEN
      -- Create new customer
      INSERT INTO customers (name, phone, store_id, created_by)
      VALUES (v_request.customer_name, v_request.customer_phone, v_request.store_id, p_user_id)
      RETURNING id INTO v_customer_id;
    END IF;

    -- Update booking request with customer_id
    UPDATE booking_requests
    SET customer_id = v_customer_id
    WHERE id = p_request_id;
  END IF;

  -- Create booking record with provided status
  INSERT INTO bookings (
    room_id,
    store_id,
    date,
    start_time,
    end_time,
    duration,
    price,
    customer_name,
    phone,
    payment_method,
    reference_no,
    status,
    created_by,
    checked_in_by,
    checked_in_at,
    confirmed_by,
    confirmed_at
  ) VALUES (
    v_request.room_id,
    v_request.store_id,
    v_request.booking_date,
    v_request.start_time,
    v_request.end_time,
    v_request.duration,
    v_request.total_price,
    v_request.customer_name,
    v_request.customer_phone,
    v_request.payment_method,
    COALESCE(v_request.payment_proof_url, '-'),
    p_status,
    p_user_id,
    CASE WHEN p_status = 'CI' THEN p_user_id ELSE NULL END,
    CASE WHEN p_status = 'CI' THEN now() ELSE NULL END,
    CASE WHEN p_status = 'BO' THEN p_user_id ELSE NULL END,
    CASE WHEN p_status = 'BO' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;


--
-- Name: generate_booking_bid(date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_booking_bid(booking_date date, p_store_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  date_str text;
  store_code text;
  next_seq integer;
  new_bid text;
  bid_pattern text;
BEGIN
  date_str := to_char(booking_date, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  bid_pattern := 'BO-' || store_code || '-' || date_str || '-%';
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM 'BO-[A-Z]+-[0-9]{8}-([0-9]+)') AS integer)), 0) + 1
  INTO next_seq
  FROM bookings
  WHERE bid LIKE bid_pattern;
  
  new_bid := 'BO-' || store_code || '-' || date_str || '-' || LPAD(next_seq::text, 3, '0');
  
  RETURN new_bid;
END;
$$;


--
-- Name: generate_booking_request_bid(date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_booking_request_bid(request_date date, p_store_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  date_str text;
  store_code text;
  next_seq integer;
  new_bid text;
  bid_pattern text;
BEGIN
  date_str := to_char(request_date, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  bid_pattern := 'BR-' || store_code || '-' || date_str || '-%';
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM 'BR-[A-Z]+-[0-9]{8}-([0-9]+)') AS integer)), 0) + 1
  INTO next_seq
  FROM booking_requests
  WHERE bid LIKE bid_pattern;
  
  new_bid := 'BR-' || store_code || '-' || date_str || '-' || LPAD(next_seq::text, 3, '0');
  
  RETURN new_bid;
END;
$$;


--
-- Name: generate_confirmation_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_confirmation_token() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN encode(gen_random_bytes(16), 'hex');
END;
$$;


--
-- Name: generate_expense_bid(date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_expense_bid(expense_date date, p_store_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  date_str text;
  store_code text;
  next_seq integer;
  new_bid text;
  bid_pattern text;
BEGIN
  date_str := to_char(expense_date, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  bid_pattern := 'OU-' || store_code || '-' || date_str || '-%';
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM 'OU-[A-Z]+-[0-9]{8}-([0-9]+)') AS integer)), 0) + 1
  INTO next_seq
  FROM expenses
  WHERE bid LIKE bid_pattern;
  
  new_bid := 'OU-' || store_code || '-' || date_str || '-' || LPAD(next_seq::text, 3, '0');
  
  RETURN new_bid;
END;
$$;


--
-- Name: generate_income_bid(date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_income_bid(income_date date, p_store_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  date_str text;
  store_code text;
  next_seq integer;
  new_bid text;
  bid_pattern text;
BEGIN
  date_str := to_char(income_date, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  bid_pattern := 'IN-' || store_code || '-' || date_str || '-%';
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM 'IN-[A-Z]+-[0-9]{8}-([0-9]+)') AS integer)), 0) + 1
  INTO next_seq
  FROM incomes
  WHERE bid LIKE bid_pattern;
  
  new_bid := 'IN-' || store_code || '-' || date_str || '-' || LPAD(next_seq::text, 3, '0');
  
  RETURN new_bid;
END;
$$;


--
-- Name: get_notification_preferences(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_notification_preferences(_user_id uuid) RETURNS TABLE(email_new_booking boolean, email_booking_cancelled boolean, email_payment_received boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    COALESCE(np.email_new_booking, true),
    COALESCE(np.email_booking_cancelled, true),
    COALESCE(np.email_payment_received, true)
  FROM public.notification_preferences np
  WHERE np.user_id = _user_id
  UNION ALL
  SELECT true, true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notification_preferences WHERE user_id = _user_id
  )
  LIMIT 1;
$$;


--
-- Name: get_store_code(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_store_code(store_id uuid) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  store_name_lower text;
  store_code text;
BEGIN
  SELECT LOWER(name) INTO store_name_lower
  FROM stores
  WHERE id = store_id;
  
  IF store_name_lower LIKE '%malang%' THEN
    store_code := 'MLG';
  ELSIF store_name_lower LIKE '%jember%' THEN
    store_code := 'JBR';
  ELSE
    store_code := 'STR';
  END IF;
  
  RETURN store_code;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;


--
-- Name: has_any_role(uuid, public.app_role[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;


--
-- Name: has_permission(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_permission(_user_id uuid, _permission_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions up
    JOIN public.permissions p ON up.permission_id = p.id
    WHERE up.user_id = _user_id AND p.name = _permission_name
  )
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: has_store_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_store_access(_user_id uuid, _store_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_store_access
    WHERE user_id = _user_id AND store_id = _store_id
  )
$$;


--
-- Name: is_store_admin(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_store_admin(_user_id uuid, _store_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_store_access
    WHERE user_id = _user_id 
      AND store_id = _store_id 
      AND role IN ('super_admin', 'admin')
  )
$$;


--
-- Name: is_super_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_store_access
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;


--
-- Name: start_payment_timer(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_payment_timer(p_request_id uuid, p_minutes integer DEFAULT 10) RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_expired_at timestamp with time zone;
BEGIN
  v_expired_at := NOW() + (p_minutes || ' minutes')::interval;
  
  UPDATE booking_requests
  SET expired_at = v_expired_at,
      payment_step_started_at = NOW()
  WHERE id = p_request_id
  AND expired_at IS NULL; -- Only set if not already set
  
  RETURN v_expired_at;
END;
$$;


--
-- Name: update_booking_status_from_request(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_booking_status_from_request(p_request_id uuid, p_user_id uuid, p_new_status text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_request record;
  v_booking_id uuid;
BEGIN
  -- Get request data
  SELECT * INTO v_request
  FROM booking_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking request not found';
  END IF;

  -- Find the booking
  SELECT id INTO v_booking_id
  FROM bookings
  WHERE room_id = v_request.room_id
  AND date = v_request.booking_date
  AND start_time = v_request.start_time
  AND store_id = v_request.store_id
  AND status IN ('BO', 'CI')
  LIMIT 1;

  IF v_booking_id IS NULL THEN
    RAISE EXCEPTION 'Booking not found for this request';
  END IF;

  -- Update booking based on new status
  IF p_new_status = 'CI' THEN
    UPDATE bookings
    SET status = 'CI',
        checked_in_by = p_user_id,
        checked_in_at = now()
    WHERE id = v_booking_id;
  ELSIF p_new_status = 'CO' THEN
    UPDATE bookings
    SET status = 'CO',
        checked_out_by = p_user_id,
        checked_out_at = now()
    WHERE id = v_booking_id;
    
    -- Update room status to available
    UPDATE rooms
    SET status = 'Aktif'
    WHERE id = v_request.room_id;
  END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    user_name text NOT NULL,
    user_role text NOT NULL,
    action_type text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    store_id uuid,
    CONSTRAINT activity_logs_action_type_check CHECK ((action_type = ANY (ARRAY['created'::text, 'updated'::text, 'deleted'::text, 'login'::text])))
);


--
-- Name: booking_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name text NOT NULL,
    product_price numeric NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    subtotal numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: booking_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    room_id uuid,
    room_name text NOT NULL,
    room_price numeric NOT NULL,
    booking_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    duration numeric NOT NULL,
    total_price numeric NOT NULL,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    customer_id uuid,
    payment_method text NOT NULL,
    payment_proof_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_notes text,
    processed_by uuid,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bid text,
    expired_at timestamp with time zone,
    payment_step_started_at timestamp with time zone,
    category_id uuid,
    category_name text,
    confirmation_token text,
    CONSTRAINT customer_name_length CHECK (((length(customer_name) >= 1) AND (length(customer_name) <= 100))),
    CONSTRAINT customer_phone_format CHECK ((customer_phone ~ '^[0-9+\-\s()]{8,20}$'::text)),
    CONSTRAINT duration_positive CHECK (((duration > (0)::numeric) AND (duration <= (24)::numeric))),
    CONSTRAINT payment_method_valid CHECK ((payment_method = ANY (ARRAY['Cash'::text, 'QRIS'::text, 'Transfer Bank'::text, 'transfer'::text]))),
    CONSTRAINT price_reasonable CHECK (((total_price >= (0)::numeric) AND (total_price <= (10000000)::numeric))),
    CONSTRAINT room_name_length CHECK (((length(room_name) >= 1) AND (length(room_name) <= 100)))
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_name text NOT NULL,
    phone text NOT NULL,
    reference_no text NOT NULL,
    room_id uuid NOT NULL,
    date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    duration numeric NOT NULL,
    price numeric NOT NULL,
    note text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_method text,
    dual_payment boolean DEFAULT false,
    payment_method_2 text,
    price_2 numeric,
    status text DEFAULT 'BO'::text,
    variant_id uuid,
    discount_type text,
    discount_value numeric DEFAULT 0,
    discount_applies_to text,
    checked_in_by uuid,
    checked_in_at timestamp with time zone,
    checked_out_by uuid,
    checked_out_at timestamp with time zone,
    confirmed_by uuid,
    confirmed_at timestamp with time zone,
    reference_no_2 text,
    bid text,
    store_id uuid,
    CONSTRAINT bookings_status_check CHECK ((status = ANY (ARRAY['BO'::text, 'CI'::text, 'CO'::text]))),
    CONSTRAINT customer_name_length CHECK (((length(customer_name) >= 1) AND (length(customer_name) <= 100))),
    CONSTRAINT duration_positive CHECK (((duration > (0)::numeric) AND (duration <= (24)::numeric))),
    CONSTRAINT note_length CHECK (((note IS NULL) OR (length(note) <= 500))),
    CONSTRAINT price_2_reasonable CHECK (((price_2 IS NULL) OR ((price_2 >= (0)::numeric) AND (price_2 <= (100000000)::numeric)))),
    CONSTRAINT price_reasonable CHECK (((price >= (0)::numeric) AND (price <= (100000000)::numeric))),
    CONSTRAINT reference_no_2_length CHECK (((reference_no_2 IS NULL) OR (length(reference_no_2) <= 200))),
    CONSTRAINT reference_no_length CHECK ((length(reference_no) <= 200))
);

ALTER TABLE ONLY public.bookings REPLICA IDENTITY FULL;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid NOT NULL,
    store_id uuid
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date NOT NULL,
    description text NOT NULL,
    amount numeric NOT NULL,
    category text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bid text,
    store_id uuid
);


--
-- Name: income_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.income_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    income_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name text NOT NULL,
    product_price numeric NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    subtotal numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: incomes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incomes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    description text,
    amount numeric,
    category text,
    date date NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bid text,
    store_id uuid,
    customer_name text,
    payment_method text,
    reference_no text
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email_new_booking boolean DEFAULT true NOT NULL,
    email_booking_cancelled boolean DEFAULT true NOT NULL,
    email_payment_received boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    price numeric NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    store_id uuid
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role public.app_role NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: room_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: room_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    variant_name text NOT NULL,
    duration numeric NOT NULL,
    price numeric NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    store_id uuid
);


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'Aktif'::text NOT NULL,
    store_id uuid,
    category text DEFAULT 'Regular'::text,
    category_id uuid,
    CONSTRAINT rooms_status_check CHECK ((status = ANY (ARRAY['Aktif'::text, 'Rusak'::text, 'Maintenance'::text, 'Occupied'::text])))
);


--
-- Name: status_colors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.status_colors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status text NOT NULL,
    color text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    store_id uuid,
    CONSTRAINT status_colors_status_check CHECK ((status = ANY (ARRAY['BO'::text, 'CI'::text, 'CO'::text])))
);


--
-- Name: stores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    location text,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    image_url text
);


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    granted_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_store_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_store_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    store_id uuid NOT NULL,
    role text DEFAULT 'staff'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_temp_passwords; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_temp_passwords (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    temp_password text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid NOT NULL,
    is_used boolean DEFAULT false NOT NULL
);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: booking_products booking_products_booking_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_products
    ADD CONSTRAINT booking_products_booking_id_product_id_key UNIQUE (booking_id, product_id);


--
-- Name: booking_products booking_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_products
    ADD CONSTRAINT booking_products_pkey PRIMARY KEY (id);


--
-- Name: booking_requests booking_requests_confirmation_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_confirmation_token_key UNIQUE (confirmation_token);


--
-- Name: booking_requests booking_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_bid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_bid_key UNIQUE (bid);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: customers customers_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_phone_key UNIQUE (phone);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_bid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_bid_key UNIQUE (bid);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: income_products income_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_products
    ADD CONSTRAINT income_products_pkey PRIMARY KEY (id);


--
-- Name: incomes incomes_bid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT incomes_bid_key UNIQUE (bid);


--
-- Name: incomes incomes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT incomes_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_permission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_permission_id_key UNIQUE (role, permission_id);


--
-- Name: room_categories room_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_categories
    ADD CONSTRAINT room_categories_pkey PRIMARY KEY (id);


--
-- Name: room_categories room_categories_store_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_categories
    ADD CONSTRAINT room_categories_store_id_name_key UNIQUE (store_id, name);


--
-- Name: room_variants room_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_variants
    ADD CONSTRAINT room_variants_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_name_store_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_name_store_id_unique UNIQUE (name, store_id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: status_colors status_colors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_colors
    ADD CONSTRAINT status_colors_pkey PRIMARY KEY (id);


--
-- Name: status_colors status_colors_status_store_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_colors
    ADD CONSTRAINT status_colors_status_store_key UNIQUE (status, store_id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_user_id_permission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_permission_id_key UNIQUE (user_id, permission_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: user_store_access user_store_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_store_access
    ADD CONSTRAINT user_store_access_pkey PRIMARY KEY (id);


--
-- Name: user_store_access user_store_access_user_id_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_store_access
    ADD CONSTRAINT user_store_access_user_id_store_id_key UNIQUE (user_id, store_id);


--
-- Name: user_temp_passwords user_temp_passwords_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_temp_passwords
    ADD CONSTRAINT user_temp_passwords_pkey PRIMARY KEY (id);


--
-- Name: idx_activity_logs_action_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_action_type ON public.activity_logs USING btree (action_type);


--
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);


--
-- Name: idx_activity_logs_entity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_entity_type ON public.activity_logs USING btree (entity_type);


--
-- Name: idx_activity_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);


--
-- Name: idx_booking_requests_confirmation_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_confirmation_token ON public.booking_requests USING btree (confirmation_token);


--
-- Name: idx_bookings_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_store_id ON public.bookings USING btree (store_id);


--
-- Name: idx_bookings_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_variant_id ON public.bookings USING btree (variant_id);


--
-- Name: idx_customers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_name ON public.customers USING btree (name);


--
-- Name: idx_customers_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_phone ON public.customers USING btree (phone);


--
-- Name: idx_customers_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_store_id ON public.customers USING btree (store_id);


--
-- Name: idx_expenses_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_created_by ON public.expenses USING btree (created_by);


--
-- Name: idx_expenses_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_date ON public.expenses USING btree (date);


--
-- Name: idx_room_variants_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_variants_active ON public.room_variants USING btree (is_active);


--
-- Name: idx_room_variants_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_variants_room_id ON public.room_variants USING btree (room_id);


--
-- Name: idx_rooms_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_status ON public.rooms USING btree (status);


--
-- Name: idx_rooms_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_store_id ON public.rooms USING btree (store_id);


--
-- Name: idx_user_store_access_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_store_access_store_id ON public.user_store_access USING btree (store_id);


--
-- Name: idx_user_store_access_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_store_access_user_id ON public.user_store_access USING btree (user_id);


--
-- Name: booking_requests booking_request_token_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_request_token_trigger BEFORE INSERT ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.auto_generate_confirmation_token();


--
-- Name: user_roles trigger_auto_assign_permissions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_assign_permissions AFTER INSERT OR UPDATE OF role ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.auto_assign_role_permissions();


--
-- Name: bookings trigger_auto_generate_booking_bid; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_generate_booking_bid BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.auto_generate_booking_bid();


--
-- Name: booking_requests trigger_auto_generate_booking_request_bid; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_generate_booking_request_bid BEFORE INSERT ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.auto_generate_booking_request_bid();


--
-- Name: expenses trigger_auto_generate_expense_bid; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_generate_expense_bid BEFORE INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.auto_generate_expense_bid();


--
-- Name: incomes trigger_auto_generate_income_bid; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_generate_income_bid BEFORE INSERT ON public.incomes FOR EACH ROW EXECUTE FUNCTION public.auto_generate_income_bid();


--
-- Name: booking_requests update_booking_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_booking_requests_updated_at BEFORE UPDATE ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bookings update_bookings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: expenses update_expenses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: incomes update_incomes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_incomes_updated_at BEFORE UPDATE ON public.incomes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_preferences update_notification_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: room_categories update_room_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_room_categories_updated_at BEFORE UPDATE ON public.room_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: room_variants update_room_variants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_room_variants_updated_at BEFORE UPDATE ON public.room_variants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: status_colors update_status_colors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_status_colors_updated_at BEFORE UPDATE ON public.status_colors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stores update_stores_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: activity_logs activity_logs_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: booking_products booking_products_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_products
    ADD CONSTRAINT booking_products_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_products booking_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_products
    ADD CONSTRAINT booking_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: booking_requests booking_requests_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.room_categories(id);


--
-- Name: booking_requests booking_requests_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: booking_requests booking_requests_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: booking_requests booking_requests_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_checked_in_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_checked_in_by_fkey FOREIGN KEY (checked_in_by) REFERENCES auth.users(id);


--
-- Name: bookings bookings_checked_out_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_checked_out_by_fkey FOREIGN KEY (checked_out_by) REFERENCES auth.users(id);


--
-- Name: bookings bookings_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id);


--
-- Name: bookings bookings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: customers customers_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: income_products income_products_income_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_products
    ADD CONSTRAINT income_products_income_id_fkey FOREIGN KEY (income_id) REFERENCES public.incomes(id) ON DELETE CASCADE;


--
-- Name: income_products income_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_products
    ADD CONSTRAINT income_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: incomes incomes_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT incomes_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: products products_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: room_categories room_categories_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_categories
    ADD CONSTRAINT room_categories_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: room_variants room_variants_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_variants
    ADD CONSTRAINT room_variants_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: room_variants room_variants_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_variants
    ADD CONSTRAINT room_variants_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: rooms rooms_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.room_categories(id);


--
-- Name: rooms rooms_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: status_colors status_colors_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_colors
    ADD CONSTRAINT status_colors_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id);


--
-- Name: user_permissions user_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_store_access user_store_access_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_store_access
    ADD CONSTRAINT user_store_access_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: user_store_access user_store_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_store_access
    ADD CONSTRAINT user_store_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_temp_passwords user_temp_passwords_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_temp_passwords
    ADD CONSTRAINT user_temp_passwords_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: user_temp_passwords user_temp_passwords_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_temp_passwords
    ADD CONSTRAINT user_temp_passwords_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Admins and leaders can create user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and leaders can create user roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role]));


--
-- Name: expenses Admins and leaders can delete expenses in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and leaders can delete expenses in their stores" ON public.expenses FOR DELETE TO authenticated USING ((((auth.uid() = created_by) OR public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role])) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))));


--
-- Name: income_products Admins and leaders can delete income products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and leaders can delete income products" ON public.income_products FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.incomes
  WHERE ((incomes.id = income_products.income_id) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), incomes.store_id))))));


--
-- Name: incomes Admins and leaders can delete incomes in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and leaders can delete incomes in their stores" ON public.incomes FOR DELETE TO authenticated USING ((((auth.uid() = created_by) OR public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role])) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))));


--
-- Name: products Admins and leaders can delete products in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and leaders can delete products in their stores" ON public.products FOR DELETE TO authenticated USING ((public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role]) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))));


--
-- Name: profiles Admins and leaders can delete profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and leaders can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role]));


--
-- Name: user_roles Admins and leaders can delete user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and leaders can delete user roles" ON public.user_roles FOR DELETE USING (public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role]));


--
-- Name: room_categories Admins and leaders can manage categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and leaders can manage categories" ON public.room_categories USING ((public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role]) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))));


--
-- Name: room_variants Admins and leaders can manage room variants in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and leaders can manage room variants in their stores" ON public.room_variants USING ((public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role]) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))));


--
-- Name: rooms Admins and leaders can modify rooms in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and leaders can modify rooms in their stores" ON public.rooms TO authenticated USING ((public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role]) AND (public.is_super_admin(auth.uid()) OR public.is_store_admin(auth.uid(), store_id))));


--
-- Name: profiles Admins and leaders can update all profiles or users own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and leaders can update all profiles or users own" ON public.profiles FOR UPDATE TO authenticated USING ((public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role]) OR (auth.uid() = id))) WITH CHECK ((public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role]) OR (auth.uid() = id)));


--
-- Name: expenses Admins and leaders can update expenses in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and leaders can update expenses in their stores" ON public.expenses FOR UPDATE TO authenticated USING ((((auth.uid() = created_by) OR public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role])) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))));


--
-- Name: incomes Admins and leaders can update incomes in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and leaders can update incomes in their stores" ON public.incomes FOR UPDATE TO authenticated USING ((((auth.uid() = created_by) OR public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role])) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))));


--
-- Name: products Admins and leaders can update products in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and leaders can update products in their stores" ON public.products FOR UPDATE TO authenticated USING ((public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role]) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))));


--
-- Name: activity_logs Admins and leaders can view activity logs in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and leaders can view activity logs in their stores" ON public.activity_logs FOR SELECT USING ((public.is_super_admin(auth.uid()) OR (public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role]) AND public.has_store_access(auth.uid(), store_id))));


--
-- Name: user_roles Admins and leaders can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and leaders can view all roles" ON public.user_roles FOR SELECT TO authenticated USING ((public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role]) OR (auth.uid() = user_id)));


--
-- Name: user_roles Admins and leaders can view all roles or users own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and leaders can view all roles or users own" ON public.user_roles FOR SELECT TO authenticated USING ((public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role]) OR (auth.uid() = user_id)));


--
-- Name: permissions Authenticated users can view permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view permissions" ON public.permissions FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: role_permissions Authenticated users can view role permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view role permissions" ON public.role_permissions FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: status_colors Authenticated users can view status colors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view status colors" ON public.status_colors FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: status_colors Only admins and leaders can modify status colors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins and leaders can modify status colors" ON public.status_colors USING (public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role]));


--
-- Name: user_permissions Only admins can grant permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can grant permissions" ON public.user_permissions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: permissions Only admins can manage permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can manage permissions" ON public.permissions USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: role_permissions Only admins can manage role permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can manage role permissions" ON public.role_permissions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_permissions Only admins can revoke permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can revoke permissions" ON public.user_permissions FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_temp_passwords Only admins can set temp passwords; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can set temp passwords" ON public.user_temp_passwords FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Only admins can update user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can update user roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_temp_passwords Only admins can view temp passwords; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can view temp passwords" ON public.user_temp_passwords FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: booking_requests Public can view booking by token; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view booking by token" ON public.booking_requests FOR SELECT USING ((confirmation_token IS NOT NULL));


--
-- Name: booking_requests Rate-limited booking creation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Rate-limited booking creation" ON public.booking_requests FOR INSERT TO authenticated, anon WITH CHECK (public.check_booking_rate_limit(customer_phone));


--
-- Name: booking_requests Staff can view store booking requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view store booking requests" ON public.booking_requests FOR SELECT TO authenticated USING ((public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id)));


--
-- Name: booking_requests Store staff can delete booking requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store staff can delete booking requests" ON public.booking_requests FOR DELETE TO authenticated USING ((public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id)));


--
-- Name: booking_requests Store staff can update booking requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store staff can update booking requests" ON public.booking_requests FOR UPDATE TO authenticated USING ((public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id)));


--
-- Name: user_store_access Super admins and store admins can delete store access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins and store admins can delete store access" ON public.user_store_access FOR DELETE TO authenticated USING ((public.is_super_admin(auth.uid()) OR public.is_store_admin(auth.uid(), store_id)));


--
-- Name: user_store_access Super admins and store admins can insert store access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins and store admins can insert store access" ON public.user_store_access FOR INSERT TO authenticated WITH CHECK ((public.is_super_admin(auth.uid()) OR public.is_store_admin(auth.uid(), store_id)));


--
-- Name: user_store_access Super admins and store admins can update store access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins and store admins can update store access" ON public.user_store_access FOR UPDATE TO authenticated USING ((public.is_super_admin(auth.uid()) OR public.is_store_admin(auth.uid(), store_id)));


--
-- Name: stores Super admins can delete stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can delete stores" ON public.stores FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));


--
-- Name: stores Super admins can insert stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can insert stores" ON public.stores FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));


--
-- Name: stores Super admins can update stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can update stores" ON public.stores FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()));


--
-- Name: customers Users can delete customers in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete customers in their stores" ON public.customers FOR DELETE TO authenticated USING ((((auth.uid() = created_by) OR public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role])) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))));


--
-- Name: activity_logs Users can insert activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert activity logs" ON public.activity_logs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: booking_products Users can insert booking products in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert booking products in their stores" ON public.booking_products FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.bookings
  WHERE ((bookings.id = booking_products.booking_id) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), bookings.store_id))))));


--
-- Name: customers Users can insert customers in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert customers in their stores" ON public.customers FOR INSERT TO authenticated WITH CHECK (((auth.uid() = created_by) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))));


--
-- Name: expenses Users can insert expenses in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert expenses in their stores" ON public.expenses FOR INSERT TO authenticated WITH CHECK (((auth.uid() = created_by) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))));


--
-- Name: income_products Users can insert income products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert income products" ON public.income_products FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.incomes
  WHERE ((incomes.id = income_products.income_id) AND (incomes.created_by = auth.uid()) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), incomes.store_id))))));


--
-- Name: incomes Users can insert incomes in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert incomes in their stores" ON public.incomes FOR INSERT TO authenticated WITH CHECK (((auth.uid() = created_by) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))));


--
-- Name: products Users can insert products in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert products in their stores" ON public.products FOR INSERT TO authenticated WITH CHECK (((auth.uid() = created_by) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))));


--
-- Name: notification_preferences Users can insert their own notification preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own notification preferences" ON public.notification_preferences FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: customers Users can update customers in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update customers in their stores" ON public.customers FOR UPDATE TO authenticated USING ((((auth.uid() = created_by) OR public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role])) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))));


--
-- Name: notification_preferences Users can update their own notification preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notification preferences" ON public.notification_preferences FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: room_variants Users can view active room variants in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view active room variants in their stores" ON public.room_variants FOR SELECT USING (((is_active = true) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))));


--
-- Name: booking_products Users can view booking products in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view booking products in their stores" ON public.booking_products FOR SELECT USING ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.bookings
  WHERE ((bookings.id = booking_products.booking_id) AND public.has_store_access(auth.uid(), bookings.store_id))))));


--
-- Name: bookings Users can view bookings in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view bookings in their stores" ON public.bookings FOR SELECT TO authenticated USING ((public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id)));


--
-- Name: room_categories Users can view categories in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view categories in their stores" ON public.room_categories FOR SELECT USING ((public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id)));


--
-- Name: customers Users can view customers in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view customers in their stores" ON public.customers FOR SELECT TO authenticated USING ((public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id)));


--
-- Name: expenses Users can view expenses in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view expenses in their stores" ON public.expenses FOR SELECT TO authenticated USING ((public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id)));


--
-- Name: income_products Users can view income products in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view income products in their stores" ON public.income_products FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.incomes
  WHERE ((incomes.id = income_products.income_id) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), incomes.store_id))))));


--
-- Name: incomes Users can view incomes in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view incomes in their stores" ON public.incomes FOR SELECT TO authenticated USING ((public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id)));


--
-- Name: profiles Users can view own profile or admins view all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile or admins view all" ON public.profiles FOR SELECT TO authenticated USING (((auth.uid() = id) OR public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role])));


--
-- Name: products Users can view products in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view products in their stores" ON public.products FOR SELECT TO authenticated USING ((public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id)));


--
-- Name: rooms Users can view rooms in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view rooms in their stores" ON public.rooms FOR SELECT TO authenticated USING ((public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id)));


--
-- Name: stores Users can view stores they have access to; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view stores they have access to" ON public.stores FOR SELECT USING (((is_active = true) AND (public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_store_access usa
  WHERE ((usa.user_id = auth.uid()) AND (usa.store_id = stores.id)))))));


--
-- Name: notification_preferences Users can view their own notification preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notification preferences" ON public.notification_preferences FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_permissions Users can view their own permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own permissions" ON public.user_permissions FOR SELECT USING (((auth.uid() = user_id) OR public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'leader'::public.app_role])));


--
-- Name: booking_products Users with delete_bookings permission can delete booking produc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with delete_bookings permission can delete booking produc" ON public.booking_products FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.bookings
  WHERE ((bookings.id = booking_products.booking_id) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), bookings.store_id))))));


--
-- Name: booking_products Users with edit_bookings permission can update booking products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with edit_bookings permission can update booking products" ON public.booking_products FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.bookings
  WHERE ((bookings.id = booking_products.booking_id) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), bookings.store_id))))));


--
-- Name: bookings Users with permission can create bookings in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with permission can create bookings in their stores" ON public.bookings FOR INSERT TO authenticated WITH CHECK ((public.has_permission(auth.uid(), 'create_bookings'::text) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id)) AND (auth.uid() = created_by)));


--
-- Name: bookings Users with permission can delete bookings in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with permission can delete bookings in their stores" ON public.bookings FOR DELETE TO authenticated USING ((public.has_permission(auth.uid(), 'delete_bookings'::text) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))));


--
-- Name: bookings Users with permission can update bookings in their stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with permission can update bookings in their stores" ON public.bookings FOR UPDATE TO authenticated USING ((public.has_permission(auth.uid(), 'edit_bookings'::text) AND (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id))));


--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_products ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: income_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.income_products ENABLE ROW LEVEL SECURITY;

--
-- Name: incomes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: room_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: room_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: rooms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

--
-- Name: status_colors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.status_colors ENABLE ROW LEVEL SECURITY;

--
-- Name: stores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

--
-- Name: user_store_access super_admins_view_all_store_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admins_view_all_store_access ON public.user_store_access FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));


--
-- Name: user_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_store_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_store_access ENABLE ROW LEVEL SECURITY;

--
-- Name: user_temp_passwords; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_temp_passwords ENABLE ROW LEVEL SECURITY;

--
-- Name: user_store_access users_view_own_store_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_view_own_store_access ON public.user_store_access FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- PostgreSQL database dump complete
--




COMMIT;