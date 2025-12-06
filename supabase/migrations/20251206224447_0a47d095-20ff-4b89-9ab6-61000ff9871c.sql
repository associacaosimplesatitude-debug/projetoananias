-- Allow students to view their own aluno record
CREATE POLICY "Students can view their own aluno record" 
ON public.ebd_alunos 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow students to view their turma
CREATE POLICY "Students can view their turma" 
ON public.ebd_turmas 
FOR SELECT 
USING (
  id IN (
    SELECT turma_id FROM public.ebd_alunos 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Allow students to view lessons from their turma
CREATE POLICY "Students can view licoes from their turma" 
ON public.ebd_licoes 
FOR SELECT 
USING (
  turma_id IN (
    SELECT turma_id FROM public.ebd_alunos 
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR (church_id IS NULL AND publicada = true)
);

-- Allow students to view quizzes from their turma
CREATE POLICY "Students can view quizzes from their turma" 
ON public.ebd_quizzes 
FOR SELECT 
USING (
  turma_id IN (
    SELECT turma_id FROM public.ebd_alunos 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Allow students to insert quiz responses
CREATE POLICY "Students can insert their quiz responses" 
ON public.ebd_quiz_respostas 
FOR INSERT 
WITH CHECK (
  aluno_id IN (
    SELECT id FROM public.ebd_alunos 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Allow students to view their quiz responses
CREATE POLICY "Students can view their quiz responses" 
ON public.ebd_quiz_respostas 
FOR SELECT 
USING (
  aluno_id IN (
    SELECT id FROM public.ebd_alunos 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Allow students to view other students in their turma for ranking
CREATE POLICY "Students can view classmates for ranking" 
ON public.ebd_alunos 
FOR SELECT 
USING (
  turma_id IN (
    SELECT turma_id FROM public.ebd_alunos 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Allow students to view their frequencia
CREATE POLICY "Students can view their frequencia" 
ON public.ebd_frequencia 
FOR SELECT 
USING (
  aluno_id IN (
    SELECT id FROM public.ebd_alunos 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Allow students to view badges
CREATE POLICY "Students can view their badges" 
ON public.ebd_aluno_badges 
FOR SELECT 
USING (
  aluno_id IN (
    SELECT id FROM public.ebd_alunos 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Allow students to view badge definitions from their church
CREATE POLICY "Students can view badge definitions" 
ON public.ebd_badges 
FOR SELECT 
USING (
  church_id IN (
    SELECT church_id FROM public.ebd_alunos 
    WHERE user_id = auth.uid() AND is_active = true
  )
);