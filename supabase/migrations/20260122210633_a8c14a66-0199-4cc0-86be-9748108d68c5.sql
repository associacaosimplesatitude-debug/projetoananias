-- Adicionar policy para permitir que alunos vejam as questões dos quizzes de sua turma
CREATE POLICY "Students can view quiz questions from their turma" 
ON ebd_quiz_questoes 
FOR SELECT 
USING (
  quiz_id IN (
    SELECT q.id 
    FROM ebd_quizzes q
    JOIN ebd_alunos a ON a.turma_id = q.turma_id
    WHERE a.user_id = auth.uid() AND a.is_active = true
  )
);