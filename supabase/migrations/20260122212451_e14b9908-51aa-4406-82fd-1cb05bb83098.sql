-- Permitir que alunos atualizem seus próprios dados (pontos, conquistas, etc)
CREATE POLICY "Students can update own record"
ON public.ebd_alunos
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);