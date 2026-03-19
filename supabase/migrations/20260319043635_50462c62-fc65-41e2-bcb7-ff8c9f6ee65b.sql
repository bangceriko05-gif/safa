
-- Add bid column to assets table
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS bid text;

-- Create function to generate asset BID for accounting-sourced assets
CREATE OR REPLACE FUNCTION public.generate_asset_bid(p_store_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  date_str text;
  store_code text;
  next_seq integer;
  new_bid text;
  bid_pattern text;
BEGIN
  date_str := to_char(CURRENT_DATE, 'YYYYMMDD');
  store_code := get_store_code(p_store_id);
  bid_pattern := 'AS-' || store_code || '-' || date_str || '-%';
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(bid FROM 'AS-[A-Z]+-[0-9]{8}-([0-9]+)') AS integer)), 0) + 1
  INTO next_seq
  FROM assets
  WHERE bid LIKE bid_pattern;
  
  new_bid := 'AS-' || store_code || '-' || date_str || '-' || LPAD(next_seq::text, 3, '0');
  
  RETURN new_bid;
END;
$function$;
