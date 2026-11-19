ALTER TABLE public.doku_payment_attempts ADD COLUMN transaction_at timestamptz;
ALTER TABLE public.doku_booking_attempts ADD COLUMN transaction_at timestamptz;
DO $$ DECLARE p regprocedure; definition text; BEGIN
FOREACH p IN ARRAY ARRAY['public.settle_doku_order(uuid,numeric,text)'::regprocedure,'public.settle_doku_booking(uuid,numeric,text)'::regprocedure] LOOP
 definition := pg_get_functiondef(p);
 definition := replace(definition, 'IF a.status<>''pending'' THEN RAISE EXCEPTION ''Payment attempt is not pending''; END IF;', 'IF a.status NOT IN (''pending'',''expired'',''failed'') THEN RAISE EXCEPTION ''Invalid payment attempt status''; END IF;');
 EXECUTE definition;
END LOOP; END $$;
CREATE OR REPLACE FUNCTION public.reconcile_doku_payment(p_source text,p_attempt_id uuid,p_amount numeric,p_channel text,p_transaction_at timestamptz) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE settled boolean;
BEGIN
 IF p_source='booking' THEN
  settled:=public.settle_doku_booking(p_attempt_id,p_amount,p_channel);
  UPDATE public.doku_booking_attempts SET transaction_at=COALESCE(p_transaction_at,transaction_at),paid_at=COALESCE(p_transaction_at,paid_at),channel=p_channel WHERE id=p_attempt_id AND status='success';
 ELSIF p_source='order' THEN
  settled:=public.settle_doku_order(p_attempt_id,p_amount,p_channel);
  UPDATE public.doku_payment_attempts SET transaction_at=COALESCE(p_transaction_at,transaction_at),paid_at=COALESCE(p_transaction_at,paid_at),channel=p_channel WHERE id=p_attempt_id AND status='success';
 ELSE RAISE EXCEPTION 'Invalid payment source'; END IF;
 RETURN settled;
END $$;
REVOKE ALL ON FUNCTION public.reconcile_doku_payment(text,uuid,numeric,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_doku_payment(text,uuid,numeric,text,timestamptz) TO service_role;