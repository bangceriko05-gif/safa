
-- Function to auto-toggle store active status based on subscription dates
CREATE OR REPLACE FUNCTION public.auto_toggle_store_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If subscription_end_date is set and has passed, deactivate
  IF NEW.subscription_end_date IS NOT NULL AND NEW.subscription_end_date::date < CURRENT_DATE THEN
    NEW.is_active := false;
  -- If subscription was extended (end_date >= today), reactivate
  ELSIF NEW.subscription_end_date IS NOT NULL AND NEW.subscription_end_date::date >= CURRENT_DATE THEN
    NEW.is_active := true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on insert/update to auto-check subscription status
CREATE TRIGGER trigger_auto_toggle_store_status
  BEFORE INSERT OR UPDATE OF subscription_end_date ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_toggle_store_status();

-- Function to check all stores and deactivate expired ones (for periodic checks)
CREATE OR REPLACE FUNCTION public.check_expired_stores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count integer;
BEGIN
  -- Deactivate expired stores
  UPDATE stores
  SET is_active = false
  WHERE subscription_end_date IS NOT NULL
    AND subscription_end_date::date < CURRENT_DATE
    AND is_active = true;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Run the check now to deactivate any currently expired stores
SELECT public.check_expired_stores();
