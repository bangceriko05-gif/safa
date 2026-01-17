-- Create room_deposits table
CREATE TABLE public.room_deposits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  deposit_type TEXT NOT NULL CHECK (deposit_type IN ('uang', 'identitas')),
  -- For money deposits
  amount NUMERIC,
  -- For identity deposits
  identity_type TEXT,
  identity_owner_name TEXT,
  -- Common fields
  notes TEXT,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned')),
  returned_at TIMESTAMP WITH TIME ZONE,
  returned_by UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.room_deposits ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view deposits in their stores" 
ON public.room_deposits 
FOR SELECT 
TO authenticated
USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Users can create deposits in their stores" 
ON public.room_deposits 
FOR INSERT 
TO authenticated
WITH CHECK (
  (auth.uid() = created_by) 
  AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id))
);

CREATE POLICY "Admins and leaders can update deposits in their stores" 
ON public.room_deposits 
FOR UPDATE 
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role]) 
  AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id))
);

CREATE POLICY "Admins and leaders can delete deposits in their stores" 
ON public.room_deposits 
FOR DELETE 
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role]) 
  AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id))
);

-- Create updated_at trigger
CREATE TRIGGER update_room_deposits_updated_at
BEFORE UPDATE ON public.room_deposits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for deposit photos
INSERT INTO storage.buckets (id, name, public) VALUES ('deposit-photos', 'deposit-photos', true)
ON CONFLICT DO NOTHING;

-- Storage policies for deposit photos
CREATE POLICY "Users can upload deposit photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'deposit-photos');

CREATE POLICY "Deposit photos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'deposit-photos');

CREATE POLICY "Users can update their deposit photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'deposit-photos');

CREATE POLICY "Users can delete deposit photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'deposit-photos');