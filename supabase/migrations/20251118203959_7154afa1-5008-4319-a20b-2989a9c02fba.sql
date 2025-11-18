-- Drop the old policy if it exists
DROP POLICY IF EXISTS "Clients can insert their own church" ON public.churches;

-- Create new policy allowing clients to insert their own church
CREATE POLICY "Clients can insert their own church"
ON public.churches
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);