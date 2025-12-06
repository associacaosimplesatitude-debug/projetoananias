-- Add RLS policy for professors to view their own record
CREATE POLICY "Professors can view their own record"
ON public.ebd_professores
FOR SELECT
USING (auth.uid() = user_id);

-- Add RLS policy for professors to view classrooms they are assigned to
CREATE POLICY "Professors can view their assigned turmas"
ON public.ebd_turmas
FOR SELECT
USING (
  ebd_turmas.id IN (
    SELECT ep.turma_id FROM public.ebd_professores ep
    WHERE ep.user_id = auth.uid() AND ep.is_active = true
  )
  OR 
  ebd_turmas.id IN (
    SELECT pt.turma_id FROM public.ebd_professores_turmas pt
    JOIN public.ebd_professores p ON pt.professor_id = p.id
    WHERE p.user_id = auth.uid() AND p.is_active = true
  )
);

-- Add policy for students to view their turma
CREATE POLICY "Students can view their own turma"
ON public.ebd_turmas
FOR SELECT
USING (
  ebd_turmas.id IN (
    SELECT ea.turma_id FROM public.ebd_alunos ea
    WHERE ea.user_id = auth.uid() AND ea.is_active = true
  )
);