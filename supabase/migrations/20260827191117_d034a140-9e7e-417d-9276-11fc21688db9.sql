DROP POLICY IF EXISTS "Admins can manage eventos" ON public.eventos;

CREATE POLICY "Admins can manage eventos"
  ON public.eventos
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'superadmin'::app_role)
    OR has_role(auth.uid(), 'gerente_ebd'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'superadmin'::app_role)
    OR has_role(auth.uid(), 'gerente_ebd'::app_role)
  );