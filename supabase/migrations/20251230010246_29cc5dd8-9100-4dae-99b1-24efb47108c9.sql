-- Adicionar política para superintendentes lerem o histórico de revistas manuais de seu cliente
CREATE POLICY "Superintendentes can view historico of their church" 
ON public.ebd_historico_revistas_manual 
FOR SELECT 
USING (
  cliente_id IN (
    SELECT id FROM ebd_clientes 
    WHERE superintendente_user_id = auth.uid()
  )
);