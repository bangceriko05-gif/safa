
-- Create store_features table to toggle PMS features per outlet
CREATE TABLE public.store_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(store_id, feature_key)
);

-- Enable RLS
ALTER TABLE public.store_features ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all store features
CREATE POLICY "Super admins can manage store features"
  ON public.store_features
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()));

-- Users can view features for their stores
CREATE POLICY "Users can view store features"
  ON public.store_features
  FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

-- Insert default features for all existing stores
INSERT INTO public.store_features (store_id, feature_key, is_enabled)
SELECT s.id, f.key, true
FROM public.stores s
CROSS JOIN (
  VALUES 
    ('calendar'),
    ('transactions'),
    ('customers'),
    ('reports'),
    ('settings'),
    ('products_inventory'),
    ('activity_log'),
    ('user_management'),
    ('booking_requests'),
    ('deposit')
) AS f(key)
ON CONFLICT (store_id, feature_key) DO NOTHING;

-- Create function to auto-insert default features for new stores
CREATE OR REPLACE FUNCTION public.auto_create_store_features()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    (NEW.id, 'deposit', true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_store_created_add_features
  AFTER INSERT ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_store_features();
