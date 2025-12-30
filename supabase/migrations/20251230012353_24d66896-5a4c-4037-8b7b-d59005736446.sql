-- Adicionar políticas para superintendentes poderem gerenciar turmas via ebd_clientes
CREATE POLICY "Superintendentes can insert turmas" 
ON public.ebd_turmas 
FOR INSERT 
WITH CHECK (
  church_id IN (
    SELECT id FROM ebd_clientes 
    WHERE superintendente_user_id = auth.uid()
  )
);

CREATE POLICY "Superintendentes can update turmas" 
ON public.ebd_turmas 
FOR UPDATE 
USING (
  church_id IN (
    SELECT id FROM ebd_clientes 
    WHERE superintendente_user_id = auth.uid()
  )
);

CREATE POLICY "Superintendentes can delete turmas" 
ON public.ebd_turmas 
FOR DELETE 
USING (
  church_id IN (
    SELECT id FROM ebd_clientes 
    WHERE superintendente_user_id = auth.uid()
  )
);

CREATE POLICY "Superintendentes can select turmas" 
ON public.ebd_turmas 
FOR SELECT 
USING (
  church_id IN (
    SELECT id FROM ebd_clientes 
    WHERE superintendente_user_id = auth.uid()
  )
);