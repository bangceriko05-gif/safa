
-- Add process_status to expenses table
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS process_status text NOT NULL DEFAULT 'proses';

-- Add process_status to incomes table  
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS process_status text NOT NULL DEFAULT 'proses';
