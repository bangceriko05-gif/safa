CREATE POLICY "Users can view their own activity logs"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);