-- Adicionar policy para admins poderem inserir lições globais
CREATE POLICY "Admins podem inserir licoes globais"
ON ebd_licoes
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND church_id IS NULL
);