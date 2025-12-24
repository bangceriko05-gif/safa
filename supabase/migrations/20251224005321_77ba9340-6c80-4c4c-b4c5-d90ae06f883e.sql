-- Drop old check constraint and add new one with BATAL status
ALTER TABLE public.status_colors DROP CONSTRAINT status_colors_status_check;
ALTER TABLE public.status_colors ADD CONSTRAINT status_colors_status_check CHECK (status = ANY (ARRAY['BO', 'CI', 'CO', 'BATAL']));

-- Add BATAL status color for all stores
INSERT INTO public.status_colors (status, color, store_id)
SELECT 'BATAL', '#9CA3AF', id FROM public.stores
ON CONFLICT DO NOTHING;