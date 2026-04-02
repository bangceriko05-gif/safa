
-- Add is_default column
ALTER TABLE public.payment_methods ADD COLUMN is_default boolean NOT NULL DEFAULT false;

-- Mark existing default methods
UPDATE public.payment_methods SET is_default = true WHERE LOWER(name) IN ('cash', 'transfer bank', 'hutang');

-- Create function to auto-create default payment methods for new stores
CREATE OR REPLACE FUNCTION public.auto_create_default_payment_methods()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.payment_methods (store_id, name, sort_order, is_default)
  VALUES
    (NEW.id, 'Cash', 0, true),
    (NEW.id, 'Transfer Bank', 1, true),
    (NEW.id, 'Hutang', 2, true);
  RETURN NEW;
END;
$$;

-- Create trigger on stores table
CREATE TRIGGER trigger_auto_create_payment_methods
AFTER INSERT ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_default_payment_methods();

-- Prevent deletion of default payment methods
CREATE POLICY "Prevent deletion of default payment methods"
ON public.payment_methods
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (is_default = false);
