CREATE OR REPLACE FUNCTION public.housekeeping_action(p_status_id uuid, p_action text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO public AS $function$
DECLARE v_row public.room_daily_status%ROWTYPE; v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
SELECT * INTO v_row FROM public.room_daily_status WHERE id=p_status_id FOR UPDATE;
IF NOT FOUND OR v_row.status <> 'Kotor' OR v_row.date <> v_today THEN RAISE EXCEPTION 'Room no longer dirty today'; END IF;
IF p_action='start' THEN
IF v_row.cleaning_started_at IS NOT NULL THEN RAISE EXCEPTION 'Cleaning already started'; END IF;
UPDATE public.room_daily_status SET cleaning_started_at=now(),cleaning_started_by=auth.uid() WHERE id=p_status_id;
ELSIF p_action='complete' THEN
IF v_row.cleaning_started_at IS NULL THEN RAISE EXCEPTION 'Cleaning not started'; END IF;
UPDATE public.room_daily_status SET status='Aktif',updated_at=now(),updated_by=auth.uid() WHERE id=p_status_id;
ELSE RAISE EXCEPTION 'Invalid cleaning action'; END IF;
END $function$;