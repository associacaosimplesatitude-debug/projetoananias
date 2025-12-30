-- Add RLS policy for professors to view turmas from their escalas
CREATE POLICY "Professors can view turmas from their escalas" 
ON public.ebd_turmas 
FOR SELECT 
USING (
  id IN (
    SELECT turma_id FROM ebd_escalas 
    WHERE professor_id IN (
      SELECT id FROM ebd_professores 
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
);