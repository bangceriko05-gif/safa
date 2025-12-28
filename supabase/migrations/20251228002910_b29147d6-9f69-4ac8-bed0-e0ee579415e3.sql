-- Add validation to SECURITY DEFINER functions
-- Update create_booking_from_request to validate store access
CREATE OR REPLACE FUNCTION public.create_booking_from_request(p_request_id uuid, p_user_id uuid, p_status text DEFAULT 'CI'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- SECURITY: Validate user has access to the store
  IF NOT is_super_admin(p_user_id) AND NOT has_store_access(p_user_id, v_request.store_id) THEN
    RAISE EXCEPTION 'User does not have access to this store';
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
    SELECT id INTO v_customer_id
    FROM customers
    WHERE phone = v_request.customer_phone
    AND store_id = v_request.store_id
    LIMIT 1;

    IF v_customer_id IS NULL THEN
      INSERT INTO customers (name, phone, store_id, created_by)
      VALUES (v_request.customer_name, v_request.customer_phone, v_request.store_id, p_user_id)
      RETURNING id INTO v_customer_id;
    END IF;

    UPDATE booking_requests
    SET customer_id = v_customer_id
    WHERE id = p_request_id;
  END IF;

  INSERT INTO bookings (
    room_id, store_id, date, start_time, end_time, duration, price,
    customer_name, phone, payment_method, reference_no, status,
    created_by, checked_in_by, checked_in_at, confirmed_by, confirmed_at
  ) VALUES (
    v_request.room_id, v_request.store_id, v_request.booking_date,
    v_request.start_time, v_request.end_time, v_request.duration,
    v_request.total_price, v_request.customer_name, v_request.customer_phone,
    v_request.payment_method, COALESCE(v_request.payment_proof_url, '-'),
    p_status, p_user_id,
    CASE WHEN p_status = 'CI' THEN p_user_id ELSE NULL END,
    CASE WHEN p_status = 'CI' THEN now() ELSE NULL END,
    CASE WHEN p_status = 'BO' THEN p_user_id ELSE NULL END,
    CASE WHEN p_status = 'BO' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$function$;

-- Update checkout_booking_by_request_id to validate store access
CREATE OR REPLACE FUNCTION public.checkout_booking_by_request_id(p_request_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request record;
  v_booking_id uuid;
BEGIN
  SELECT * INTO v_request
  FROM booking_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking request not found';
  END IF;

  -- SECURITY: Validate user has access to the store
  IF NOT is_super_admin(p_user_id) AND NOT has_store_access(p_user_id, v_request.store_id) THEN
    RAISE EXCEPTION 'User does not have access to this store';
  END IF;

  SELECT id INTO v_booking_id
  FROM bookings
  WHERE room_id = v_request.room_id
  AND date = v_request.booking_date
  AND start_time = v_request.start_time
  AND store_id = v_request.store_id
  AND status = 'CI'
  LIMIT 1;

  IF v_booking_id IS NOT NULL THEN
    UPDATE bookings
    SET status = 'CO',
        checked_out_by = p_user_id,
        checked_out_at = now()
    WHERE id = v_booking_id;
  END IF;
END;
$function$;

-- Update update_booking_status_from_request to validate store access
CREATE OR REPLACE FUNCTION public.update_booking_status_from_request(p_request_id uuid, p_user_id uuid, p_new_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request record;
  v_booking_id uuid;
BEGIN
  SELECT * INTO v_request
  FROM booking_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking request not found';
  END IF;

  -- SECURITY: Validate user has access to the store
  IF NOT is_super_admin(p_user_id) AND NOT has_store_access(p_user_id, v_request.store_id) THEN
    RAISE EXCEPTION 'User does not have access to this store';
  END IF;

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
    
    UPDATE rooms SET status = 'Aktif' WHERE id = v_request.room_id;
  END IF;
END;
$function$;

-- Add input validation constraints to booking_requests
ALTER TABLE public.booking_requests DROP CONSTRAINT IF EXISTS valid_customer_name;
ALTER TABLE public.booking_requests ADD CONSTRAINT valid_customer_name 
  CHECK (length(trim(customer_name)) >= 2 AND length(customer_name) <= 100);

ALTER TABLE public.booking_requests DROP CONSTRAINT IF EXISTS valid_customer_phone;
ALTER TABLE public.booking_requests ADD CONSTRAINT valid_customer_phone 
  CHECK (customer_phone ~ '^[0-9+\-\s()]{8,20}$');

-- Create safe first admin promotion function with locking
CREATE OR REPLACE FUNCTION public.safe_promote_first_admin(p_user_id UUID) 
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_count INT;
BEGIN
  -- Lock the table to prevent race conditions
  LOCK TABLE user_roles IN EXCLUSIVE MODE;
  
  SELECT COUNT(*) INTO admin_count
  FROM user_roles WHERE role = 'admin';
  
  IF admin_count > 0 THEN
    RETURN FALSE;
  END IF;
  
  UPDATE user_roles SET role = 'admin' WHERE user_id = p_user_id;
  
  -- Log the event
  INSERT INTO activity_logs (user_id, user_name, user_role, action_type, entity_type, description)
  VALUES (p_user_id, 'System', 'system', 'privilege_escalation', 'System', 'First admin account created via safe_promote_first_admin');
  
  RETURN TRUE;
END;
$$;

-- Create cleanup function for expired booking requests
CREATE OR REPLACE FUNCTION public.cleanup_expired_booking_requests() 
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM booking_requests 
  WHERE status = 'pending' 
  AND (
    (expired_at IS NOT NULL AND expired_at < NOW() - INTERVAL '1 hour')
    OR (created_at < NOW() - INTERVAL '24 hours')
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Storage bucket security - make payment-proofs private and add RLS
UPDATE storage.buckets SET public = false WHERE id = 'payment-proofs';

-- Create storage policies for payment-proofs bucket
DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects;
CREATE POLICY "Authenticated users can upload payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "Store admins can view payment proofs" ON storage.objects;
CREATE POLICY "Store admins can view payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs' AND (
    is_super_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM booking_requests br
      WHERE br.payment_proof_url LIKE '%' || name
      AND has_store_access(auth.uid(), br.store_id)
    )
  )
);

DROP POLICY IF EXISTS "Public can upload payment proofs" ON storage.objects;
CREATE POLICY "Public can upload payment proofs"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'payment-proofs');

-- Store images policies
DROP POLICY IF EXISTS "Store admins can upload store images" ON storage.objects;
CREATE POLICY "Store admins can upload store images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'store-images' AND
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role])
);

DROP POLICY IF EXISTS "Authenticated users can view store images" ON storage.objects;
CREATE POLICY "Authenticated users can view store images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'store-images');

DROP POLICY IF EXISTS "Store admins can delete store images" ON storage.objects;
CREATE POLICY "Store admins can delete store images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'store-images' AND
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role])
);