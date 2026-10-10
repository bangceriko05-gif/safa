CREATE TABLE public.whatsapp_message_settings (
 store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
 booking_message text NOT NULL,
 check_in_message text NOT NULL,
 check_out_message text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT whatsapp_messages_length CHECK (char_length(booking_message) BETWEEN 1 AND 4000 AND char_length(check_in_message) BETWEEN 1 AND 4000 AND char_length(check_out_message) BETWEEN 1 AND 4000)
);
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_message_settings TO authenticated;
GRANT ALL ON public.whatsapp_message_settings TO service_role;
ALTER TABLE public.whatsapp_message_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read outlet WhatsApp messages" ON public.whatsapp_message_settings FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR public.has_store_access(auth.uid(), store_id));
CREATE POLICY "Create outlet WhatsApp messages" ON public.whatsapp_message_settings FOR INSERT TO authenticated WITH CHECK (public.is_store_admin(auth.uid(), store_id) OR (public.has_store_access(auth.uid(), store_id) AND public.has_permission(auth.uid(), 'manage_settings')));
CREATE POLICY "Update outlet WhatsApp messages" ON public.whatsapp_message_settings FOR UPDATE TO authenticated USING (public.is_store_admin(auth.uid(), store_id) OR (public.has_store_access(auth.uid(), store_id) AND public.has_permission(auth.uid(), 'manage_settings'))) WITH CHECK (public.is_store_admin(auth.uid(), store_id) OR (public.has_store_access(auth.uid(), store_id) AND public.has_permission(auth.uid(), 'manage_settings')));
CREATE TRIGGER whatsapp_message_settings_updated_at BEFORE UPDATE ON public.whatsapp_message_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();