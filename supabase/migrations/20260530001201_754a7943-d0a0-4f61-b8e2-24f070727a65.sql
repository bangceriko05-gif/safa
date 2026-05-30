
-- Permissions for granular product/store management
INSERT INTO public.permissions (name, description) VALUES
  ('view_product_detail', 'Lihat detail produk'),
  ('create_products', 'Tambah produk'),
  ('delete_products', 'Hapus produk'),
  ('view_store_detail', 'Lihat detail toko'),
  ('create_stores', 'Tambah toko'),
  ('delete_stores', 'Hapus toko')
ON CONFLICT (name) DO NOTHING;

-- Fix FK constraints that block product deletion
ALTER TABLE public.stock_opname_items DROP CONSTRAINT IF EXISTS stock_opname_items_product_id_fkey;
ALTER TABLE public.stock_opname_items ADD CONSTRAINT stock_opname_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.stock_out_items DROP CONSTRAINT IF EXISTS stock_out_items_product_id_fkey;
ALTER TABLE public.stock_out_items ADD CONSTRAINT stock_out_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.income_products DROP CONSTRAINT IF EXISTS income_products_product_id_fkey;
ALTER TABLE public.income_products ADD CONSTRAINT income_products_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
