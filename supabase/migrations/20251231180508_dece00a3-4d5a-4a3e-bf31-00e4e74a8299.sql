-- Add RLS policies for Superintendentes to manage ebd_alunos
-- Currently only Church owners and Admins can manage, but Superintendentes should also be able to

-- Policy for Superintendentes to INSERT alunos
CREATE POLICY "Superintendentes can insert alunos"
ON public.ebd_alunos
FOR INSERT
WITH CHECK (
  church_id IN (
    SELECT id FROM ebd_clientes
    WHERE superintendente_user_id = auth.uid()
    AND status_ativacao_ebd = true
  )
);

-- Policy for Superintendentes to UPDATE alunos
CREATE POLICY "Superintendentes can update alunos"
ON public.ebd_alunos
FOR UPDATE
USING (
  church_id IN (
    SELECT id FROM ebd_clientes
    WHERE superintendente_user_id = auth.uid()
    AND status_ativacao_ebd = true
  )
)
WITH CHECK (
  church_id IN (
    SELECT id FROM ebd_clientes
    WHERE superintendente_user_id = auth.uid()
    AND status_ativacao_ebd = true
  )
);

-- Policy for Superintendentes to DELETE alunos
CREATE POLICY "Superintendentes can delete alunos"
ON public.ebd_alunos
FOR DELETE
USING (
  church_id IN (
    SELECT id FROM ebd_clientes
    WHERE superintendente_user_id = auth.uid()
    AND status_ativacao_ebd = true
  )
);

-- Policy for Superintendentes to SELECT alunos
CREATE POLICY "Superintendentes can select alunos"
ON public.ebd_alunos
FOR SELECT
USING (
  church_id IN (
    SELECT id FROM ebd_clientes
    WHERE superintendente_user_id = auth.uid()
    AND status_ativacao_ebd = true
  )
);