DROP POLICY IF EXISTS "Outlet users read DOKU attempts" ON public.doku_payment_attempts;
CREATE POLICY "Outlet admins read DOKU attempts" ON public.doku_payment_attempts FOR SELECT TO authenticated USING (public.is_store_admin(auth.uid(), store_id));
CREATE OR REPLACE FUNCTION public.settle_doku_order(p_attempt_id uuid,p_amount numeric,p_channel text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.doku_payment_attempts%ROWTYPE; o public.booking_orders%ROWTYPE; remaining numeric;
BEGIN
 SELECT * INTO a FROM public.doku_payment_attempts WHERE id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR a.amount<>p_amount OR p_amount<=0 THEN RAISE EXCEPTION 'Invalid payment confirmation'; END IF;
 IF a.status='success' THEN RETURN false; END IF;
 IF a.status<>'pending' THEN RAISE EXCEPTION 'Payment attempt is not pending'; END IF;
 SELECT * INTO o FROM public.booking_orders WHERE id=a.order_id AND store_id=a.store_id FOR UPDATE;
 IF NOT FOUND OR o.process_status='batal' THEN RAISE EXCEPTION 'Order unavailable'; END IF;
 remaining := COALESCE(o.total_amount,0)-COALESCE(o.amount,0)-COALESCE(o.amount_2,0);
 IF remaining<>p_amount THEN RAISE EXCEPTION 'Outstanding balance changed'; END IF;
 UPDATE public.doku_payment_attempts SET status='success',channel=p_channel,paid_at=now(),updated_at=now() WHERE id=a.id;
 IF COALESCE(o.amount,0)>0 THEN
  UPDATE public.booking_orders SET amount_2=COALESCE(amount_2,0)+p_amount,dual_payment=true,payment_method_2='DOKU '||p_channel,reference_no_2=a.invoice_number,payment_status='lunas' WHERE id=o.id;
 ELSE
  UPDATE public.booking_orders SET amount=p_amount,payment_method='DOKU '||p_channel,reference_no=a.invoice_number,payment_status='lunas' WHERE id=o.id;
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.settle_doku_order(uuid,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_doku_order(uuid,numeric,text) TO service_role;