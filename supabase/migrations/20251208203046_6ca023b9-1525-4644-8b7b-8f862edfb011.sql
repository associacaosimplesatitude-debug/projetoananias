-- Allow superintendents to view their own record in ebd_clientes
CREATE POLICY "Superintendentes can view their own record"
ON public.ebd_clientes
FOR SELECT
USING (superintendente_user_id = auth.uid());