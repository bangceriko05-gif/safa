-- Add print_format column to print_settings table
ALTER TABLE public.print_settings 
ADD COLUMN print_format text NOT NULL DEFAULT 'pdf';

-- Add comment for clarity
COMMENT ON COLUMN public.print_settings.print_format IS 'Format print: pdf (generate PDF) or thermal (direct thermal print)';