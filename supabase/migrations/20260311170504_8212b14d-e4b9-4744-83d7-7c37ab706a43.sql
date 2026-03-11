CREATE POLICY "Managers can update revistas files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'revistas' AND public.can_manage_revistas(auth.uid()))
  WITH CHECK (bucket_id = 'revistas' AND public.can_manage_revistas(auth.uid()));