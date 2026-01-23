-- Política RLS para professores visualizarem alunos da igreja
CREATE POLICY "Professores podem ver alunos da igreja"
ON public.ebd_alunos
FOR SELECT
TO authenticated
USING (
  church_id IN (
    SELECT p.church_id 
    FROM public.ebd_professores p
    WHERE p.user_id = auth.uid() 
    AND p.is_active = true
  )
);

-- Política RLS para professores visualizarem frequência da igreja
CREATE POLICY "Professores podem ver frequencia da igreja"
ON public.ebd_frequencia
FOR SELECT
TO authenticated
USING (
  church_id IN (
    SELECT p.church_id 
    FROM public.ebd_professores p
    WHERE p.user_id = auth.uid() 
    AND p.is_active = true
  )
);