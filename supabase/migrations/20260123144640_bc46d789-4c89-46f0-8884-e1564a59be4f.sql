-- Política RLS para superintendentes visualizarem respostas de quizzes da sua igreja
CREATE POLICY "Superintendentes can view quiz responses for their church"
ON public.ebd_quiz_respostas
FOR SELECT
USING (
  quiz_id IN (
    SELECT q.id FROM public.ebd_quizzes q
    JOIN public.ebd_turmas t ON q.turma_id = t.id
    WHERE public.is_ebd_superintendent(auth.uid(), t.church_id)
  )
);

-- Política RLS para professores visualizarem respostas de quizzes da sua igreja
CREATE POLICY "Professores can view quiz responses for their church"
ON public.ebd_quiz_respostas
FOR SELECT
USING (
  quiz_id IN (
    SELECT q.id FROM public.ebd_quizzes q
    JOIN public.ebd_turmas t ON q.turma_id = t.id
    WHERE EXISTS (
      SELECT 1 FROM public.ebd_professores p
      WHERE p.user_id = auth.uid()
        AND p.church_id = t.church_id
        AND p.is_active = true
    )
  )
);