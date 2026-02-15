
-- Create OTA sources table
CREATE TABLE public.ota_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ota_sources ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view OTA sources in their stores"
ON public.ota_sources FOR SELECT
USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Admins and leaders can manage OTA sources"
ON public.ota_sources FOR ALL
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role]) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));

-- Add OTA fields to bookings table
ALTER TABLE public.bookings
ADD COLUMN ota_booking_id TEXT DEFAULT NULL,
ADD COLUMN ota_source TEXT DEFAULT NULL;
