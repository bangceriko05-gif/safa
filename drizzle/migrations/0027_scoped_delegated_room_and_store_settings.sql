CREATE POLICY delegated_colors_manage ON public.status_colors FOR ALL TO authenticated USING (public.has_store_access(auth.uid(),store_id) AND public.has_permission(auth.uid(),'settings_colors')) WITH CHECK (public.has_store_access(auth.uid(),store_id) AND public.has_permission(auth.uid(),'settings_colors'));
CREATE POLICY delegated_room_settings_select ON public.room_variants FOR SELECT TO authenticated USING (public.has_store_access(auth.uid(),store_id) AND public.has_permission(auth.uid(),'settings_rooms'));
CREATE POLICY delegated_room_settings_update ON public.room_variants FOR UPDATE TO authenticated USING (public.has_store_access(auth.uid(),store_id) AND public.has_permission(auth.uid(),'settings_rooms')) WITH CHECK (public.has_store_access(auth.uid(),store_id) AND public.has_permission(auth.uid(),'settings_rooms'));
CREATE FUNCTION public.guard_delegated_room_settings() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF auth.uid() IS NOT NULL AND NOT public.is_store_admin(auth.uid(),OLD.store_id) AND NOT public.is_super_admin(auth.uid()) THEN
 IF NOT public.has_permission(auth.uid(),'settings_rooms') OR (to_jsonb(NEW) - ARRAY['visibility_type','visible_days','booking_duration_type','booking_duration_value','updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['visibility_type','visible_days','booking_duration_type','booking_duration_value','updated_at']) THEN RAISE EXCEPTION 'Perubahan ini memerlukan izin pengelolaan kamar.'; END IF;
END IF; RETURN NEW; END $$;
CREATE TRIGGER guard_delegated_room_settings BEFORE UPDATE ON public.room_variants FOR EACH ROW EXECUTE FUNCTION public.guard_delegated_room_settings();
CREATE FUNCTION public.save_delegated_store_settings(p_store_id uuid,p_section text,p_values jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE permission_name text; allowed_keys text[]; BEGIN
permission_name := CASE p_section WHEN 'tax' THEN 'settings_tax' WHEN 'rooms' THEN 'settings_rooms' WHEN 'outlet' THEN 'settings_outlet' END;
allowed_keys := CASE p_section WHEN 'tax' THEN ARRAY['tax_enabled','tax_rate','tax_modes_allowed'] WHEN 'rooms' THEN ARRAY['schedule_start_time','schedule_end_time','schedule_slot_minutes'] WHEN 'outlet' THEN ARRAY['name','description','location','image_url','slug'] END;
IF auth.uid() IS NULL OR permission_name IS NULL OR NOT public.has_store_access(auth.uid(),p_store_id) OR NOT (public.is_store_admin(auth.uid(),p_store_id) OR public.has_permission(auth.uid(),permission_name)) THEN RAISE EXCEPTION 'Anda tidak memiliki izin untuk pengaturan outlet ini.'; END IF;
IF jsonb_typeof(p_values) <> 'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_values) k WHERE NOT k=ANY(allowed_keys)) THEN RAISE EXCEPTION 'Pengaturan yang diubah tidak sesuai izin.'; END IF;
IF p_section='tax' THEN UPDATE public.stores SET tax_enabled=(p_values->>'tax_enabled')::boolean,tax_rate=(p_values->>'tax_rate')::numeric,tax_modes_allowed=ARRAY(SELECT jsonb_array_elements_text(p_values->'tax_modes_allowed')) WHERE id=p_store_id;
ELSIF p_section='rooms' THEN UPDATE public.stores SET schedule_start_time=p_values->>'schedule_start_time',schedule_end_time=p_values->>'schedule_end_time',schedule_slot_minutes=(p_values->>'schedule_slot_minutes')::integer WHERE id=p_store_id;
ELSIF p_section='outlet' THEN UPDATE public.stores SET name=p_values->>'name',description=p_values->>'description',location=p_values->>'location',image_url=p_values->>'image_url',slug=p_values->>'slug' WHERE id=p_store_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_delegated_store_settings(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_delegated_store_settings(uuid,text,jsonb) TO authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.status_colors TO authenticated;
GRANT SELECT,UPDATE ON public.room_variants TO authenticated;