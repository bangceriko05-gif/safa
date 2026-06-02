ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS no_rek text;

-- Pindahkan data notes lama (yang berisi no rek) ke kolom no_rek, lalu kosongkan notes
UPDATE public.suppliers SET no_rek = notes WHERE no_rek IS NULL AND notes IS NOT NULL;
UPDATE public.suppliers SET notes = NULL WHERE no_rek IS NOT NULL AND notes = no_rek;