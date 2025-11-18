-- Permitir que o dono da igreja veja suas contas a receber
CREATE POLICY "Church owners can view their receivables"
ON public.accounts_receivable
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.churches
    WHERE churches.id = accounts_receivable.church_id
      AND churches.user_id = auth.uid()
  )
);