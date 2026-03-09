
-- Create bank_accounts table
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage bank accounts"
ON public.bank_accounts
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id));

CREATE POLICY "Users can view bank accounts in their stores"
ON public.bank_accounts
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id));
