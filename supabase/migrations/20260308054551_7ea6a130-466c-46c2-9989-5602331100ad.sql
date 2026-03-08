
-- Insert sub-feature keys for all existing stores
INSERT INTO public.store_features (store_id, feature_key, is_enabled)
SELECT s.id, f.key, true
FROM public.stores s
CROSS JOIN (
  VALUES 
    -- Transaksi sub-features
    ('transactions.list_booking'),
    ('transactions.expenses'),
    ('transactions.incomes'),
    ('transactions.deposits'),
    -- Laporan sub-features
    ('reports.overview'),
    ('reports.sales'),
    ('reports.income_expense'),
    ('reports.purchase'),
    ('reports.employee'),
    -- Pengaturan sub-features
    ('settings.display'),
    ('settings.colors'),
    ('settings.notifications'),
    ('settings.print'),
    ('settings.rooms'),
    ('settings.outlet'),
    ('settings.ota'),
    -- Produk & Inventori sub-features
    ('products_inventory.rooms'),
    ('products_inventory.products'),
    ('products_inventory.categories')
) AS f(key)
ON CONFLICT (store_id, feature_key) DO NOTHING;

-- Update auto-create trigger to include sub-features
CREATE OR REPLACE FUNCTION public.auto_create_store_features()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.store_features (store_id, feature_key, is_enabled)
  VALUES
    -- Main features
    (NEW.id, 'calendar', true),
    (NEW.id, 'transactions', true),
    (NEW.id, 'customers', true),
    (NEW.id, 'reports', true),
    (NEW.id, 'settings', true),
    (NEW.id, 'products_inventory', true),
    (NEW.id, 'activity_log', true),
    (NEW.id, 'user_management', true),
    (NEW.id, 'booking_requests', true),
    (NEW.id, 'deposit', true),
    -- Transaksi sub-features
    (NEW.id, 'transactions.list_booking', true),
    (NEW.id, 'transactions.expenses', true),
    (NEW.id, 'transactions.incomes', true),
    (NEW.id, 'transactions.deposits', true),
    -- Laporan sub-features
    (NEW.id, 'reports.overview', true),
    (NEW.id, 'reports.sales', true),
    (NEW.id, 'reports.income_expense', true),
    (NEW.id, 'reports.purchase', true),
    (NEW.id, 'reports.employee', true),
    -- Pengaturan sub-features
    (NEW.id, 'settings.display', true),
    (NEW.id, 'settings.colors', true),
    (NEW.id, 'settings.notifications', true),
    (NEW.id, 'settings.print', true),
    (NEW.id, 'settings.rooms', true),
    (NEW.id, 'settings.outlet', true),
    (NEW.id, 'settings.ota', true),
    -- Produk & Inventori sub-features
    (NEW.id, 'products_inventory.rooms', true),
    (NEW.id, 'products_inventory.products', true),
    (NEW.id, 'products_inventory.categories', true);
  RETURN NEW;
END;
$$;
