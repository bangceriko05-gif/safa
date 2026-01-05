-- Add identity columns to customers table
ALTER TABLE public.customers 
ADD COLUMN identity_type text,
ADD COLUMN identity_number text,
ADD COLUMN identity_document_url text;

-- Create storage bucket for identity documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('identity-documents', 'identity-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for identity documents
CREATE POLICY "Authenticated users can upload identity documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'identity-documents' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can view identity documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'identity-documents' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can update identity documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'identity-documents' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can delete identity documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'identity-documents' 
  AND auth.uid() IS NOT NULL
);