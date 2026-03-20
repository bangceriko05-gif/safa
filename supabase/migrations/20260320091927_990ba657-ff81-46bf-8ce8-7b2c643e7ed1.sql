ALTER TABLE public.store_features 
ADD COLUMN activation_price TEXT DEFAULT NULL,
ADD COLUMN activation_description TEXT DEFAULT NULL;