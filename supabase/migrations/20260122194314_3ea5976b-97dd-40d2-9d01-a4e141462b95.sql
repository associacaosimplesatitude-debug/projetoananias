-- Adicionar políticas RLS para permitir superintendentes e professores criarem quizzes

-- 1. Permitir superintendentes gerenciarem quizzes da sua igreja (INSERT, UPDATE, DELETE)
CREATE POLICY "Superintendentes can manage quizzes"
ON public.ebd_quizzes
FOR ALL
TO authenticated
USING (
  public.is_ebd_superintendente_for_church(auth.uid(), church_id)
)
WITH CHECK (
  public.is_ebd_superintendente_for_church(auth.uid(), church_id)
);

-- 2. Permitir professores gerenciarem quizzes de qualquer turma da sua igreja
CREATE POLICY "Professores can manage quizzes"
ON public.ebd_quizzes
FOR ALL
TO authenticated
USING (
  church_id IN (
    SELECT church_id FROM public.ebd_professores 
    WHERE user_id = auth.uid() AND is_active = true
  )
)
WITH CHECK (
  church_id IN (
    SELECT church_id FROM public.ebd_professores 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- 3. Permitir superintendentes gerenciarem questões de quizzes da sua igreja
CREATE POLICY "Superintendentes can manage quiz questoes"
ON public.ebd_quiz_questoes
FOR ALL
TO authenticated
USING (
  quiz_id IN (
    SELECT id FROM public.ebd_quizzes 
    WHERE public.is_ebd_superintendente_for_church(auth.uid(), church_id)
  )
)
WITH CHECK (
  quiz_id IN (
    SELECT id FROM public.ebd_quizzes 
    WHERE public.is_ebd_superintendente_for_church(auth.uid(), church_id)
  )
);

-- 4. Permitir professores gerenciarem questões de quizzes da sua igreja
CREATE POLICY "Professores can manage quiz questoes"
ON public.ebd_quiz_questoes
FOR ALL
TO authenticated
USING (
  quiz_id IN (
    SELECT q.id FROM public.ebd_quizzes q
    INNER JOIN public.ebd_professores p ON q.church_id = p.church_id
    WHERE p.user_id = auth.uid() AND p.is_active = true
  )
)
WITH CHECK (
  quiz_id IN (
    SELECT q.id FROM public.ebd_quizzes q
    INNER JOIN public.ebd_professores p ON q.church_id = p.church_id
    WHERE p.user_id = auth.uid() AND p.is_active = true
  )
);