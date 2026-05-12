-- 1) Drop the public booking_requests SELECT policy (module is permanently removed)
DROP POLICY IF EXISTS "Public can view booking by token" ON public.booking_requests;

-- 2) Restrict realtime.messages so only authenticated users can subscribe.
--    Underlying postgres_changes events still go through RLS on the source tables.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can receive realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can send realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can send realtime"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);