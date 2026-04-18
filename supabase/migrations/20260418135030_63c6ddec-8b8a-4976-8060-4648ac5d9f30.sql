-- Add Point of Sale feature group; pos.inventory replaces products_inventory.inventory
INSERT INTO public.store_features (store_id, feature_key, is_enabled)
SELECT s.id, 'pos', false FROM public.stores s
WHERE NOT EXISTS (SELECT 1 FROM public.store_features sf WHERE sf.store_id = s.id AND sf.feature_key = 'pos');

INSERT INTO public.store_features (store_id, feature_key, is_enabled)
SELECT s.id, 'pos.inventory', false FROM public.stores s
WHERE NOT EXISTS (SELECT 1 FROM public.store_features sf WHERE sf.store_id = s.id AND sf.feature_key = 'pos.inventory');

-- Remove deprecated key products_inventory.inventory
DELETE FROM public.store_features WHERE feature_key = 'products_inventory.inventory';

-- Update trigger to seed pos / pos.inventory and drop products_inventory.inventory for new stores
CREATE OR REPLACE FUNCTION public.auto_create_store_features()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.store_features (store_id, feature_key, is_enabled)
  VALUES
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
    (NEW.id, 'pos', false),
    (NEW.id, 'transactions.list_booking', true),
    (NEW.id, 'transactions.expenses', true),
    (NEW.id, 'transactions.incomes', true),
    (NEW.id, 'transactions.deposits', true),
    (NEW.id, 'transactions.purchases', true),
    (NEW.id, 'reports.overview', true),
    (NEW.id, 'reports.sales', true),
    (NEW.id, 'reports.income_expense', true),
    (NEW.id, 'reports.purchase', true),
    (NEW.id, 'reports.employee', true),
    (NEW.id, 'reports.accounting', true),
    (NEW.id, 'settings.display', true),
    (NEW.id, 'settings.colors', true),
    (NEW.id, 'settings.notifications', true),
    (NEW.id, 'settings.print', true),
    (NEW.id, 'settings.rooms', true),
    (NEW.id, 'settings.outlet', true),
    (NEW.id, 'settings.ota', true),
    (NEW.id, 'products_inventory.rooms', true),
    (NEW.id, 'products_inventory.products', true),
    (NEW.id, 'products_inventory.categories', true),
    (NEW.id, 'pos.inventory', false);
  RETURN NEW;
END;
$function$;