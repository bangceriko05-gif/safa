-- Enable realtime for bookings table
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;

-- Enable realtime for rooms table  
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;