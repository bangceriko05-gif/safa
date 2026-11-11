CREATE OR REPLACE FUNCTION public.settle_doku_booking(p_attempt_id uuid, p_amount numeric, p_channel text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a public.doku_booking_attempts%ROWTYPE; b public.bookings%ROWTYPE; remaining numeric;
BEGIN
 SELECT * INTO a FROM public.doku_booking_attempts WHERE id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR a.amount<>p_amount OR p_amount<=0 THEN RAISE EXCEPTION 'Invalid payment confirmation'; END IF;
 IF a.status='success' THEN RETURN false; END IF;
 IF a.status<>'pending' THEN RAISE EXCEPTION 'Payment attempt is not pending'; END IF;
 SELECT * INTO b FROM public.bookings WHERE id=a.booking_id AND store_id=a.store_id FOR UPDATE;
 IF NOT FOUND OR b.status='BATAL' THEN RAISE EXCEPTION 'Booking unavailable'; END IF;
 PERFORM id FROM public.bookings WHERE store_id=a.store_id AND (id=b.id OR (b.booking_group_id IS NOT NULL AND booking_group_id=b.booking_group_id)) ORDER BY id FOR UPDATE;
 remaining:=public.doku_booking_balance(b.id);
 IF p_amount>remaining THEN RAISE EXCEPTION 'Outstanding balance changed'; END IF;
 IF COALESCE(b.price,0)>0 THEN
   IF COALESCE(b.price_2,0)>0 AND b.payment_method_2 IS DISTINCT FROM 'QRIS DOKU' THEN RAISE EXCEPTION 'Second payment method already used'; END IF;
   UPDATE public.bookings SET dual_payment=true,price_2=COALESCE(price_2,0)+p_amount,payment_method_2='QRIS DOKU',reference_no_2=a.invoice_number WHERE id=b.id AND store_id=a.store_id;
 ELSE
   IF COALESCE(b.price_2,0)>0 THEN RAISE EXCEPTION 'Payment owner already changed'; END IF;
   UPDATE public.bookings SET price=p_amount,payment_method='QRIS DOKU',reference_no=a.invoice_number WHERE id=b.id AND store_id=a.store_id;
 END IF;
 UPDATE public.bookings SET payment_status=CASE WHEN p_amount>=remaining THEN 'lunas' ELSE 'belum_lunas' END WHERE store_id=a.store_id AND status<>'BATAL' AND (id=b.id OR (b.booking_group_id IS NOT NULL AND booking_group_id=b.booking_group_id));
 UPDATE public.doku_booking_attempts SET status='success',channel=p_channel,paid_at=now(),updated_at=now() WHERE id=a.id;
 RETURN true;
END $function$;