
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(store_id, name)
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment methods in their stores"
ON public.payment_methods FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));

CREATE POLICY "Admins and leaders can manage payment methods"
ON public.payment_methods FOR ALL
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role]) AND (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)));
