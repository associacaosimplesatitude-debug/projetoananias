-- Corrigir recursão infinita entre ebd_turmas e ebd_professores_turmas
ALTER POLICY "Church owners can manage their professores_turmas"
ON public.ebd_professores_turmas
USING (
  professor_id IN (
    SELECT p.id
    FROM public.ebd_professores p
    WHERE p.church_id IN (
      SELECT c.id
      FROM public.churches c
      WHERE c.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  professor_id IN (
    SELECT p.id
    FROM public.ebd_professores p
    WHERE p.church_id IN (
      SELECT c.id
      FROM public.churches c
      WHERE c.user_id = auth.uid()
    )
  )
);
