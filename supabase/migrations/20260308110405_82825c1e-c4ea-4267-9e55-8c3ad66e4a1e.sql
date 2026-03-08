
-- Create landing page settings table
CREATE TABLE public.landing_page_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Hero section
  hero_tagline text DEFAULT '#SolusiPropertiAnda',
  hero_title text DEFAULT 'Kelola Properti Lebih Mudah & Efisien!',
  hero_description text DEFAULT 'ANKA PMS adalah sistem manajemen properti all-in-one untuk hotel, kost, guest house, dan penginapan. Kelola booking, keuangan, dan operasional dari satu platform.',
  hero_image_url text,
  -- Contact info
  contact_email text DEFAULT 'info@anka.management',
  contact_phone text DEFAULT '+62 812 3456 7890',
  contact_whatsapp text DEFAULT '6281234567890',
  contact_address text DEFAULT 'Malang, Jawa Timur',
  -- Stats
  stats_properties text DEFAULT '100+',
  stats_support text DEFAULT '24/7',
  stats_uptime text DEFAULT '99.9%',
  -- CTA section
  cta_title text DEFAULT 'Siap Mengelola Properti Lebih Baik?',
  cta_description text DEFAULT 'Daftar sekarang dan nikmati semua fitur premium ANKA PMS untuk properti Anda.',
  -- Footer
  footer_description text DEFAULT 'Solusi manajemen properti modern untuk hotel, kost, guest house, dan penginapan di Indonesia.',
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.landing_page_settings ENABLE ROW LEVEL SECURITY;

-- Public can read landing page settings
CREATE POLICY "Public can view landing page settings" ON public.landing_page_settings
  FOR SELECT USING (true);

-- Only super admins can modify
CREATE POLICY "Super admins can manage landing page settings" ON public.landing_page_settings
  FOR ALL USING (is_super_admin(auth.uid()));

-- Insert default row
INSERT INTO public.landing_page_settings (id) VALUES (gen_random_uuid());

-- Update trigger
CREATE TRIGGER update_landing_page_settings_updated_at
  BEFORE UPDATE ON public.landing_page_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
