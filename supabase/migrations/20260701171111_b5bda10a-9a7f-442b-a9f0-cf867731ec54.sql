DROP TRIGGER IF EXISTS trigger_auto_toggle_store_status ON public.stores;

CREATE TRIGGER trigger_auto_toggle_store_status
  BEFORE INSERT OR UPDATE OF subscription_end_date, is_active ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_toggle_store_status();

SELECT public.check_expired_stores();