
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Apply stock for any auto-linked stock_in that hasn't been applied yet.
  -- Heuristic: re-trigger by toggling status. Since toggling needs OLD<>NEW, we go posted->draft->posted.
  FOR r IN SELECT id FROM public.stock_in WHERE purchase_id IS NOT NULL AND status='posted' LOOP
    UPDATE public.stock_in SET status='draft' WHERE id=r.id;
    UPDATE public.stock_in SET status='posted', posted_at=now() WHERE id=r.id;
  END LOOP;
END;
$$;
