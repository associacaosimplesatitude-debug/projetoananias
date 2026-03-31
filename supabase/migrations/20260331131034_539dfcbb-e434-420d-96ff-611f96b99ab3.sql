CREATE POLICY "Public can read licoes"
ON public.revista_licoes
FOR SELECT
TO anon
USING (true);