-- Update the trigger function to insert into room_daily_status instead of updating rooms table
CREATE OR REPLACE FUNCTION public.set_room_kotor_on_booking_checkout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'CO' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Insert or update the room_daily_status for this specific date
    INSERT INTO public.room_daily_status (room_id, date, status, updated_by)
    VALUES (NEW.room_id, NEW.date, 'Kotor', NEW.checked_out_by)
    ON CONFLICT (room_id, date) 
    DO UPDATE SET status = 'Kotor', updated_at = now(), updated_by = NEW.checked_out_by;
  END IF;

  RETURN NEW;
END;
$function$;