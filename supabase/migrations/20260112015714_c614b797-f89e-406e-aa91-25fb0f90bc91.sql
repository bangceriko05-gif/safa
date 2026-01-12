-- Create print_settings table for storing printer/receipt configuration per store
CREATE TABLE public.print_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  paper_size VARCHAR(20) DEFAULT '80mm',
  logo_url TEXT,
  business_name VARCHAR(255),
  business_address TEXT,
  business_phone VARCHAR(50),
  manager_name VARCHAR(255),
  footer_text TEXT,
  show_logo BOOLEAN DEFAULT true,
  show_manager_signature BOOLEAN DEFAULT true,
  show_qr_code BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_id)
);

-- Enable RLS
ALTER TABLE public.print_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users with store access can view print settings"
ON public.print_settings
FOR SELECT
USING (
  public.has_store_access(store_id, auth.uid()) OR 
  public.is_super_admin(auth.uid())
);

CREATE POLICY "Admins and leaders can manage print settings"
ON public.print_settings
FOR ALL
USING (
  public.is_store_admin(store_id, auth.uid()) OR 
  public.is_super_admin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.user_store_access usa
    WHERE usa.user_id = auth.uid()
    AND usa.store_id = print_settings.store_id
    AND usa.role = 'leader'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_print_settings_updated_at
BEFORE UPDATE ON public.print_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();