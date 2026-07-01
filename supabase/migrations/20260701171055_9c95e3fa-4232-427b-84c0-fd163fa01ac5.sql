CREATE OR REPLACE FUNCTION public.auto_toggle_store_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Tanggal akhir langganan adalah hari terakhir masa aktif.
  -- Jika tanggal akhir sudah hari ini atau lewat, outlet otomatis nonaktif.
  IF NEW.subscription_end_date IS NOT NULL AND NEW.subscription_end_date::date <= CURRENT_DATE THEN
    NEW.is_active := false;
  -- Jika langganan diperpanjang ke tanggal setelah hari ini, outlet otomatis aktif kembali.
  ELSIF NEW.subscription_end_date IS NOT NULL AND NEW.subscription_end_date::date > CURRENT_DATE THEN
    NEW.is_active := true;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_expired_stores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.stores
  SET is_active = false
  WHERE subscription_end_date IS NOT NULL
    AND subscription_end_date::date <= CURRENT_DATE
    AND is_active = true;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

SELECT public.check_expired_stores();