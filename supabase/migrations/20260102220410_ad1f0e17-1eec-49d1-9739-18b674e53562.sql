-- Permitir que superintendentes atualizem seus próprios registros de ebd_clientes
CREATE POLICY "Superintendentes can update their own record"
ON public.ebd_clientes
FOR UPDATE
USING (superintendente_user_id = auth.uid())
WITH CHECK (superintendente_user_id = auth.uid());