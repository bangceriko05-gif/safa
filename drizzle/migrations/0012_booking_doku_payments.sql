CREATE TABLE public.doku_booking_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), store_id uuid NOT NULL REFERENCES public.stores(id), booking_id uuid NOT NULL REFERENCES public.bookings(id), invoice_number text NOT NULL UNIQUE, environment text NOT NULL, client_id text NOT NULL, amount numeric NOT NULL, status text NOT NULL DEFAULT 'pending', checkout_url text, channel text, paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.doku_booking_attempts TO authenticated;
GRANT ALL ON public.doku_booking_attempts TO service_role;
ALTER TABLE public.doku_booking_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Outlet members read booking payment attempts" ON public.doku_booking_attempts FOR SELECT TO authenticated USING (public.has_store_access(auth.uid(),store_id) OR public.is_super_admin(auth.uid()));
CREATE UNIQUE INDEX doku_one_pending_booking ON public.doku_booking_attempts(booking_id) WHERE status='pending';
CREATE OR REPLACE FUNCTION public.doku_booking_balance(p_booking_id uuid) RETURNS numeric LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE b public.bookings%ROWTYPE; owner_row public.bookings%ROWTYPE; rooms_total numeric; products_total numeric; paid numeric; discount numeric; base numeric;
BEGIN
 SELECT * INTO b FROM public.bookings WHERE id=p_booking_id;
 IF NOT FOUND OR b.status='BATAL' THEN RAISE EXCEPTION 'Booking unavailable'; END IF;
 SELECT x.* INTO owner_row FROM public.bookings x WHERE x.store_id=b.store_id AND (x.id=b.id OR (b.booking_group_id IS NOT NULL AND x.booking_group_id=b.booking_group_id)) ORDER BY ((CASE WHEN x.payment_proof_url IS NOT NULL THEN 8 ELSE 0 END)+(CASE WHEN x.payment_method IS NOT NULL THEN 4 ELSE 0 END)+(CASE WHEN x.price>0 THEN 2 ELSE 0 END)+(CASE WHEN x.discount_value>0 THEN 1 ELSE 0 END)) DESC,x.id LIMIT 1;
 SELECT COALESCE(sum(CASE WHEN x.status='BATAL' THEN 0 WHEN x.ota_source IS NOT NULL OR x.ota_booking_id IS NOT NULL THEN COALESCE(x.variant_price_override*x.duration,x.price,0) ELSE COALESCE(COALESCE(x.variant_price_override,v.price)*(CASE WHEN v.booking_duration_type IN ('months','weeks') THEN COALESCE(v.booking_duration_value,1) ELSE x.duration END),x.price,0) END),0),COALESCE(sum(COALESCE(x.price,0)+CASE WHEN x.dual_payment THEN COALESCE(x.price_2,0) ELSE 0 END),0) INTO rooms_total,paid FROM public.bookings x LEFT JOIN public.room_variants v ON v.id=x.variant_id WHERE x.store_id=b.store_id AND (x.id=b.id OR (b.booking_group_id IS NOT NULL AND x.booking_group_id=b.booking_group_id));
 SELECT COALESCE(sum(p.subtotal),0) INTO products_total FROM public.booking_products p JOIN public.bookings x ON x.id=p.booking_id WHERE x.store_id=b.store_id AND (x.id=b.id OR (b.booking_group_id IS NOT NULL AND x.booking_group_id=b.booking_group_id));
 base:=CASE WHEN owner_row.discount_applies_to='product' THEN products_total WHEN owner_row.discount_applies_to='all' THEN rooms_total+products_total ELSE rooms_total END;
 discount:=LEAST(rooms_total+products_total,CASE WHEN owner_row.discount_type IN ('percent','percentage') THEN round(base*COALESCE(owner_row.discount_value,0)/100) ELSE COALESCE(owner_row.discount_value,0) END);
 RETURN GREATEST(0,rooms_total+products_total-discount)-paid;
END $$;
REVOKE ALL ON FUNCTION public.doku_booking_balance(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.doku_booking_balance(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.settle_doku_booking(p_attempt_id uuid,p_amount numeric,p_channel text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
 IF remaining<>p_amount THEN RAISE EXCEPTION 'Outstanding balance changed'; END IF;
 IF COALESCE(b.price,0)>0 OR COALESCE(b.price_2,0)>0 THEN RAISE EXCEPTION 'Payment owner already changed'; END IF;
 UPDATE public.bookings SET price=p_amount,payment_method='QRIS DOKU',reference_no=a.invoice_number WHERE id=b.id AND store_id=a.store_id;
 UPDATE public.bookings SET payment_status='lunas' WHERE store_id=a.store_id AND status<>'BATAL' AND (id=b.id OR (b.booking_group_id IS NOT NULL AND booking_group_id=b.booking_group_id));
 UPDATE public.doku_booking_attempts SET status='success',channel=p_channel,paid_at=now(),updated_at=now() WHERE id=a.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.settle_doku_booking(uuid,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_doku_booking(uuid,numeric,text) TO service_role;