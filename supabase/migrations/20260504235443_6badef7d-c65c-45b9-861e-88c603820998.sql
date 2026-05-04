
CREATE POLICY "Admins podem inserir infograficos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'infograficos-pdf'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins podem atualizar infograficos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'infograficos-pdf'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins podem deletar infograficos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'infograficos-pdf'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins podem listar infograficos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'infograficos-pdf'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
