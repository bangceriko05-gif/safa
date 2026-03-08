
ALTER TABLE public.landing_page_settings
ADD COLUMN IF NOT EXISTS gallery_tagline text DEFAULT 'Preview Aplikasi',
ADD COLUMN IF NOT EXISTS gallery_title text DEFAULT 'Lihat ANKA PMS Beraksi',
ADD COLUMN IF NOT EXISTS gallery_description text DEFAULT 'Tampilan dashboard dan fitur-fitur utama ANKA PMS.',
ADD COLUMN IF NOT EXISTS gallery_items jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS pricing_tagline text DEFAULT 'Paket Harga',
ADD COLUMN IF NOT EXISTS pricing_title text DEFAULT 'Pilih Paket yang Tepat',
ADD COLUMN IF NOT EXISTS pricing_description text DEFAULT 'Pilihan paket fleksibel untuk setiap skala properti Anda.',
ADD COLUMN IF NOT EXISTS pricing_items jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS partners_tagline text DEFAULT 'Dipercaya Oleh',
ADD COLUMN IF NOT EXISTS partners_title text DEFAULT 'Brand yang Sudah Bekerjasama',
ADD COLUMN IF NOT EXISTS partner_logos jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS navbar_menu_pricing text DEFAULT 'Harga',
ADD COLUMN IF NOT EXISTS navbar_menu_gallery text DEFAULT 'Gallery';
