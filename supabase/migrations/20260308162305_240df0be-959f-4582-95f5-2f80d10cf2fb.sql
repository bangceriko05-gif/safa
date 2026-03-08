
CREATE TABLE public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL,
  room_count text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public form)
CREATE POLICY "Anyone can submit demo request"
  ON public.demo_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only authenticated admins can read
CREATE POLICY "Admins can read demo requests"
  ON public.demo_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
