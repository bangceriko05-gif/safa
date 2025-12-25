-- Ensure room status becomes 'Kotor' automatically when a booking is checked out (status -> 'CO')

CREATE OR REPLACE FUNCTION public.set_room_kotor_on_booking_checkout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'CO' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.rooms
    SET status = 'Kotor'
    WHERE id = NEW.room_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_room_kotor_on_booking_checkout ON public.bookings;

CREATE TRIGGER trg_set_room_kotor_on_booking_checkout
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.set_room_kotor_on_booking_checkout();
