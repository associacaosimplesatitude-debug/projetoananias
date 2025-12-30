-- Adicionar política para superintendentes de ebd_clientes gerenciarem ebd_professores_turmas
CREATE POLICY "Superintendentes podem gerenciar professores_turmas" 
ON public.ebd_professores_turmas 
FOR ALL 
TO authenticated
USING (
  professor_id IN (
    SELECT p.id FROM public.ebd_professores p
    WHERE p.church_id IN (
      SELECT ec.id FROM public.ebd_clientes ec
      WHERE ec.superintendente_user_id = auth.uid()
    )
  )
)
WITH CHECK (
  professor_id IN (
    SELECT p.id FROM public.ebd_professores p
    WHERE p.church_id IN (
      SELECT ec.id FROM public.ebd_clientes ec
      WHERE ec.superintendente_user_id = auth.uid()
    )
  )
);