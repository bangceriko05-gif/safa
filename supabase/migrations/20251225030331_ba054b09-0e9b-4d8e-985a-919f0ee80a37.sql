-- Drop the trigger first, then the function
DROP TRIGGER IF EXISTS trg_set_room_kotor_on_booking_checkout ON public.bookings;
DROP FUNCTION IF EXISTS public.set_room_kotor_on_booking_checkout();