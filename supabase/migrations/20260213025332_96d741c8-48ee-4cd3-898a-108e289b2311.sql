
-- Create expense_categories table
CREATE TABLE public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name, store_id)
);

-- Enable RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view expense categories for their stores"
ON public.expense_categories FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid()) OR has_store_access(auth.uid(), store_id)
);

CREATE POLICY "Admins can insert expense categories"
ON public.expense_categories FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id)
);

CREATE POLICY "Admins can update expense categories"
ON public.expense_categories FOR UPDATE TO authenticated
USING (
  is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id)
);

CREATE POLICY "Admins can delete expense categories"
ON public.expense_categories FOR DELETE TO authenticated
USING (
  is_super_admin(auth.uid()) OR is_store_admin(auth.uid(), store_id)
);

-- Add payment_method and payment_proof_url to expenses
ALTER TABLE public.expenses ADD COLUMN payment_method TEXT;
ALTER TABLE public.expenses ADD COLUMN payment_proof_url TEXT;

-- Trigger for updated_at
CREATE TRIGGER update_expense_categories_updated_at
BEFORE UPDATE ON public.expense_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
