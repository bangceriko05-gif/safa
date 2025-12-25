-- Create table for date-specific room status
CREATE TABLE public.room_daily_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Kotor',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID,
  UNIQUE(room_id, date)
);

-- Enable RLS
ALTER TABLE public.room_daily_status ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view room daily status in their stores"
ON public.room_daily_status
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = room_daily_status.room_id
    AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), r.store_id))
  )
);

CREATE POLICY "Users with permission can manage room daily status"
ON public.room_daily_status
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = room_daily_status.room_id
    AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), r.store_id))
  )
);

-- Create index for faster lookups
CREATE INDEX idx_room_daily_status_room_date ON public.room_daily_status(room_id, date);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_daily_status;