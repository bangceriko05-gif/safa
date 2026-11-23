ALTER TABLE public.room_daily_status ADD COLUMN cleaning_started_at timestamptz, ADD COLUMN cleaning_started_by uuid;
CREATE OR REPLACE FUNCTION public.reset_room_cleaning_progress() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN IF NEW.status = 'Kotor' AND OLD.status IS DISTINCT FROM 'Kotor' THEN NEW.cleaning_started_at := NULL; NEW.cleaning_started_by := NULL; END IF; RETURN NEW; END $$;
CREATE TRIGGER reset_room_cleaning_progress BEFORE UPDATE ON public.room_daily_status FOR EACH ROW EXECUTE FUNCTION public.reset_room_cleaning_progress();
CREATE OR REPLACE FUNCTION public.housekeeping_action(p_status_id uuid, p_action text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_row public.room_daily_status%ROWTYPE; v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
SELECT * INTO v_row FROM public.room_daily_status WHERE id = p_status_id FOR UPDATE;
IF NOT FOUND OR v_row.status <> 'Kotor' OR v_row.date > v_today THEN RAISE EXCEPTION 'Room no longer dirty'; END IF;
IF EXISTS (SELECT 1 FROM public.room_daily_status WHERE room_id=v_row.room_id AND date>v_row.date AND date<=v_today) THEN RAISE EXCEPTION 'Room status changed'; END IF;
IF p_action='start' THEN
IF v_row.cleaning_started_at IS NOT NULL THEN RAISE EXCEPTION 'Cleaning already started'; END IF;
UPDATE public.room_daily_status SET cleaning_started_at=now(), cleaning_started_by=auth.uid() WHERE id=p_status_id;
ELSIF p_action='complete' THEN
IF v_row.cleaning_started_at IS NULL THEN RAISE EXCEPTION 'Cleaning not started'; END IF;
UPDATE public.room_daily_status SET status='Aktif',updated_at=now(),updated_by=auth.uid() WHERE id=p_status_id;
IF v_row.date<v_today THEN
INSERT INTO public.room_daily_status(room_id,date,status,updated_at,updated_by,cleaning_started_at,cleaning_started_by) VALUES(v_row.room_id,v_today,'Aktif',now(),auth.uid(),v_row.cleaning_started_at,v_row.cleaning_started_by) ON CONFLICT(room_id,date) DO UPDATE SET status='Aktif',updated_at=now(),updated_by=auth.uid(),cleaning_started_at=v_row.cleaning_started_at,cleaning_started_by=v_row.cleaning_started_by;
END IF;
ELSE RAISE EXCEPTION 'Invalid cleaning action'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.housekeeping_action(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.housekeeping_action(uuid,text) TO authenticated,service_role;