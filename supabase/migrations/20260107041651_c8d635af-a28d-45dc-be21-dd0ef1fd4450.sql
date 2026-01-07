-- Create login_settings table for customizing login page appearance
CREATE TABLE public.login_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL DEFAULT 'Safa Kost & Guesthouse',
  subtitle TEXT DEFAULT 'Masukkan email dan password Anda',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  background_color TEXT DEFAULT '#f8fafc',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_id)
);

-- Enable RLS
ALTER TABLE public.login_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access for login page
CREATE POLICY "Login settings are publicly readable"
ON public.login_settings
FOR SELECT
USING (true);

-- Only admins can update login settings
CREATE POLICY "Admins can manage login settings"
ON public.login_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_store_access usa
    WHERE usa.store_id = login_settings.store_id
    AND usa.user_id = auth.uid()
    AND usa.role = 'admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_login_settings_updated_at
BEFORE UPDATE ON public.login_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();