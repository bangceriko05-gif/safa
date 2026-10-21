CREATE TABLE public.doku_outlet_credentials (
 store_id uuid NOT NULL REFERENCES public.stores(id),
 environment text NOT NULL,
 client_id text NOT NULL,
 secret_ciphertext text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(store_id,environment)
);
GRANT ALL ON public.doku_outlet_credentials TO service_role;
ALTER TABLE public.doku_outlet_credentials ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.save_doku_outlet_settings(p_store_id uuid,p_environment text,p_client_id text,p_ciphertext text,p_enabled boolean,p_channels jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_ciphertext IS NOT NULL THEN
  INSERT INTO public.doku_outlet_credentials(store_id,environment,client_id,secret_ciphertext) VALUES(p_store_id,p_environment,p_client_id,p_ciphertext)
  ON CONFLICT(store_id,environment) DO UPDATE SET client_id=EXCLUDED.client_id,secret_ciphertext=EXCLUDED.secret_ciphertext,updated_at=now();
 ELSIF p_enabled AND NOT EXISTS(SELECT 1 FROM public.doku_outlet_credentials WHERE store_id=p_store_id AND environment=p_environment AND client_id=p_client_id) THEN
  RAISE EXCEPTION 'Credentials required';
 END IF;
 INSERT INTO public.website_payment_settings(store_id,doku_environment,doku_client_id,doku_enabled,doku_channels) VALUES(p_store_id,p_environment,p_client_id,p_enabled,p_channels)
 ON CONFLICT(store_id) DO UPDATE SET doku_environment=EXCLUDED.doku_environment,doku_client_id=EXCLUDED.doku_client_id,doku_enabled=EXCLUDED.doku_enabled,doku_channels=EXCLUDED.doku_channels;
END $$;
REVOKE ALL ON FUNCTION public.save_doku_outlet_settings(uuid,text,text,text,boolean,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_doku_outlet_settings(uuid,text,text,text,boolean,jsonb) TO service_role;