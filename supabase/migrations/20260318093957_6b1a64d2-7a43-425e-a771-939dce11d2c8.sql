
CREATE TABLE public.accounting_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  user_role text NOT NULL,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  description text NOT NULL,
  store_id uuid REFERENCES public.stores(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.accounting_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert accounting logs" ON public.accounting_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and leaders can view accounting logs" ON public.accounting_activity_logs
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid()) 
    OR (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leader'::app_role]) AND has_store_access(auth.uid(), store_id))
  );
