CREATE TABLE public.customer_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_types TO authenticated;
GRANT ALL ON public.customer_types TO service_role;

ALTER TABLE public.customer_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_types_select" ON public.customer_types FOR SELECT TO authenticated
USING (public.has_store_access(auth.uid(), store_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "customer_types_insert" ON public.customer_types FOR INSERT TO authenticated
WITH CHECK (public.has_store_access(auth.uid(), store_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "customer_types_update" ON public.customer_types FOR UPDATE TO authenticated
USING (public.has_store_access(auth.uid(), store_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "customer_types_delete" ON public.customer_types FOR DELETE TO authenticated
USING (public.has_store_access(auth.uid(), store_id) OR public.is_super_admin(auth.uid()));