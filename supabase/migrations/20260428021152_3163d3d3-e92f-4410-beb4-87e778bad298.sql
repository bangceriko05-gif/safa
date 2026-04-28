-- 1. Tarif PPN per toko (default 11%)
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC NOT NULL DEFAULT 11;

-- 2. Mode PPN per produk: 'include' atau 'exclude'
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tax_mode TEXT NOT NULL DEFAULT 'exclude';

-- 3. Snapshot PPN pada line item (saat transaksi disimpan, kunci angka)
ALTER TABLE public.booking_products
  ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_mode TEXT NOT NULL DEFAULT 'exclude',
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dpp_amount NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.income_products
  ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_mode TEXT NOT NULL DEFAULT 'exclude',
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dpp_amount NUMERIC NOT NULL DEFAULT 0;

-- 4. PPN pada booking kamar (varian/kamar)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_mode TEXT NOT NULL DEFAULT 'exclude',
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dpp_amount NUMERIC NOT NULL DEFAULT 0;

-- 5. PPN pada incomes (transaksi pemasukan custom)
ALTER TABLE public.incomes
  ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_mode TEXT NOT NULL DEFAULT 'exclude',
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dpp_amount NUMERIC NOT NULL DEFAULT 0;

-- 6. Index untuk query laporan PPN
CREATE INDEX IF NOT EXISTS idx_booking_products_tax_enabled ON public.booking_products(tax_enabled) WHERE tax_enabled = true;
CREATE INDEX IF NOT EXISTS idx_income_products_tax_enabled ON public.income_products(tax_enabled) WHERE tax_enabled = true;
CREATE INDEX IF NOT EXISTS idx_bookings_tax_enabled ON public.bookings(tax_enabled) WHERE tax_enabled = true;
CREATE INDEX IF NOT EXISTS idx_incomes_tax_enabled ON public.incomes(tax_enabled) WHERE tax_enabled = true;