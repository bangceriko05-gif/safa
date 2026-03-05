
ALTER TABLE public.stores 
ADD COLUMN subscription_start_date date DEFAULT NULL,
ADD COLUMN subscription_end_date date DEFAULT NULL;
