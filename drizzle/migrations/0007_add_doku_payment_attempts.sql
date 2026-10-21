CREATE TABLE public.doku_payment_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES public.stores(id),
 order_id uuid NOT NULL REFERENCES public.booking_orders(id),
 invoice_number text NOT NULL UNIQUE,
 environment text NOT NULL,
 client_id text NOT NULL,
 amount numeric NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 checkout_url text,
 channel text,
 paid_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.doku_payment_attempts TO authenticated;
GRANT ALL ON public.doku_payment_attempts TO service_role;
ALTER TABLE public.doku_payment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Outlet users read DOKU attempts" ON public.doku_payment_attempts FOR SELECT TO authenticated USING (public.has_store_access(auth.uid(),store_id) OR public.is_super_admin(auth.uid()));
CREATE UNIQUE INDEX doku_one_pending_order ON public.doku_payment_attempts(order_id) WHERE status='pending';
CREATE INDEX doku_outlet_created ON public.doku_payment_attempts(store_id,created_at DESC);
COMMENT ON COLUMN public.website_payment_settings.doku_secret_key IS 'DEPRECATED: DOKU credentials are held only in runtime secret storage; never read or write from browser';
REVOKE SELECT,INSERT,UPDATE ON public.website_payment_settings FROM authenticated;
GRANT SELECT(id,store_id,doku_enabled,doku_environment,doku_client_id,doku_channels,manual_transfer_note,created_at,updated_at) ON public.website_payment_settings TO authenticated;
GRANT INSERT(store_id,doku_enabled,doku_environment,doku_client_id,doku_channels,manual_transfer_note) ON public.website_payment_settings TO authenticated;
GRANT UPDATE(doku_enabled,doku_environment,doku_client_id,doku_channels,manual_transfer_note) ON public.website_payment_settings TO authenticated;
CREATE OR REPLACE FUNCTION public.settle_doku_order(p_attempt_id uuid,p_amount numeric,p_channel text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.doku_payment_attempts%ROWTYPE; o public.booking_orders%ROWTYPE;
BEGIN
 SELECT * INTO a FROM public.doku_payment_attempts WHERE id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR a.amount<>p_amount OR p_amount<=0 THEN RAISE EXCEPTION 'Invalid payment confirmation'; END IF;
 IF a.status='success' THEN RETURN false; END IF;
 SELECT * INTO o FROM public.booking_orders WHERE id=a.order_id AND store_id=a.store_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 UPDATE public.doku_payment_attempts SET status='success',channel=p_channel,paid_at=now(),updated_at=now() WHERE id=a.id;
 IF o.process_status='batal' THEN RETURN true; END IF;
 IF COALESCE(o.amount,0)>0 AND o.payment_method NOT LIKE '%DOKU%' THEN
  UPDATE public.booking_orders SET amount_2=COALESCE(amount_2,0)+p_amount,dual_payment=true,payment_method_2='DOKU '||p_channel,reference_no_2=a.invoice_number,
  payment_status=CASE WHEN amount+COALESCE(amount_2,0)+p_amount>=total_amount THEN 'lunas' ELSE 'belum_lunas' END WHERE id=o.id AND store_id=a.store_id;
 ELSE
  UPDATE public.booking_orders SET amount=COALESCE(amount,0)+p_amount,payment_method='DOKU '||p_channel,reference_no=a.invoice_number,
  payment_status=CASE WHEN COALESCE(amount,0)+COALESCE(amount_2,0)+p_amount>=total_amount THEN 'lunas' ELSE 'belum_lunas' END WHERE id=o.id AND store_id=a.store_id;
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.settle_doku_order(uuid,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_doku_order(uuid,numeric,text) TO service_role;