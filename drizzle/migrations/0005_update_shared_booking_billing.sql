CREATE OR REPLACE FUNCTION public.update_shared_booking_billing(p_booking_id uuid, p_payment jsonb, p_room_rates jsonb, p_products jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_group uuid; v_store uuid; v_owner uuid; v_count integer; v_updated integer; v_rate jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT booking_group_id, store_id INTO v_group,v_store FROM public.bookings WHERE id=p_booking_id;
 IF v_group IS NULL THEN RAISE EXCEPTION 'Grouped booking required'; END IF;
 PERFORM id FROM public.bookings WHERE booking_group_id=v_group AND store_id=v_store ORDER BY id FOR UPDATE;
 SELECT count(*) INTO v_count FROM public.bookings WHERE booking_group_id=v_group AND store_id=v_store;
 SELECT id INTO v_owner FROM public.bookings WHERE booking_group_id=v_group AND store_id=v_store ORDER BY (CASE WHEN payment_proof_url IS NOT NULL THEN 8 ELSE 0 END + CASE WHEN payment_method IS NOT NULL THEN 4 ELSE 0 END + CASE WHEN price>0 THEN 2 ELSE 0 END + CASE WHEN discount_value>0 THEN 1 ELSE 0 END) DESC,id LIMIT 1;
 IF v_count<2 OR v_owner IS NULL THEN RAISE EXCEPTION 'Incomplete booking group'; END IF;
 IF COALESCE((p_payment->>'price')::numeric,0)<0 OR COALESCE((p_payment->>'price_2')::numeric,0)<0 THEN RAISE EXCEPTION 'Invalid payment'; END IF;
 FOR v_rate IN SELECT value FROM jsonb_array_elements(p_room_rates) LOOP
  UPDATE public.bookings SET variant_price_override=(v_rate->>'rate')::numeric WHERE id=(v_rate->>'id')::uuid AND booking_group_id=v_group AND store_id=v_store AND status IS DISTINCT FROM 'BATAL';
  IF NOT FOUND THEN RAISE EXCEPTION 'Room unavailable for billing update'; END IF;
 END LOOP;
 UPDATE public.bookings SET
 price=CASE WHEN id=v_owner THEN COALESCE((p_payment->>'price')::numeric,0) ELSE 0 END,
 price_2=CASE WHEN id=v_owner THEN (p_payment->>'price_2')::numeric ELSE NULL END,
 dual_payment=CASE WHEN id=v_owner THEN COALESCE((p_payment->>'dual_payment')::boolean,false) ELSE false END,
 payment_method=CASE WHEN id=v_owner THEN p_payment->>'payment_method' ELSE NULL END,
 payment_method_2=CASE WHEN id=v_owner THEN p_payment->>'payment_method_2' ELSE NULL END,
 reference_no=CASE WHEN id=v_owner THEN p_payment->>'reference_no' ELSE '-' END,
 reference_no_2=CASE WHEN id=v_owner THEN p_payment->>'reference_no_2' ELSE NULL END,
 payment_proof_url=CASE WHEN id=v_owner THEN p_payment->>'payment_proof_url' ELSE NULL END,
 payment_proof_url_2=CASE WHEN id=v_owner THEN p_payment->>'payment_proof_url_2' ELSE NULL END,
 discount_type=CASE WHEN id=v_owner THEN p_payment->>'discount_type' ELSE NULL END,
 discount_value=CASE WHEN id=v_owner THEN COALESCE((p_payment->>'discount_value')::numeric,0) ELSE 0 END,
 discount_applies_to=CASE WHEN id=v_owner THEN p_payment->>'discount_applies_to' ELSE NULL END,
 payment_status=p_payment->>'payment_status'
 WHERE booking_group_id=v_group AND store_id=v_store;
 GET DIAGNOSTICS v_updated=ROW_COUNT;
 IF v_updated<>v_count THEN RAISE EXCEPTION 'Not authorized to update entire group'; END IF;
 DELETE FROM public.booking_products WHERE booking_id IN (SELECT id FROM public.bookings WHERE booking_group_id=v_group AND store_id=v_store);
 INSERT INTO public.booking_products(booking_id,product_id,product_name,product_price,quantity,subtotal)
 SELECT v_owner,(value->>'product_id')::uuid,value->>'product_name',(value->>'product_price')::numeric,(value->>'quantity')::integer,(value->>'subtotal')::numeric FROM jsonb_array_elements(p_products);
END; $$;
REVOKE ALL ON FUNCTION public.update_shared_booking_billing(uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_shared_booking_billing(uuid,jsonb,jsonb,jsonb) TO authenticated,service_role;