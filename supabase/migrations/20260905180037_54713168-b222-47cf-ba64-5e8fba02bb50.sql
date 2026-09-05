ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS barcode_code text;
CREATE UNIQUE INDEX IF NOT EXISTS rooms_barcode_code_key ON public.rooms (barcode_code) WHERE barcode_code IS NOT NULL;

ALTER TABLE public.booking_orders ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS booking_orders_room_id_idx ON public.booking_orders (room_id);

-- Allow public (anon) to resolve a room by its barcode code
DROP POLICY IF EXISTS "Anyone can read rooms by barcode" ON public.rooms;
CREATE POLICY "Anyone can read rooms by barcode"
ON public.rooms FOR SELECT
TO anon
USING (barcode_code IS NOT NULL);

GRANT SELECT ON public.rooms TO anon;