-- Add policy for superintendentes to insert their own addresses
CREATE POLICY "Superintendentes can insert their own address"
ON public.ebd_endereco_entrega
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR user_id IN (
    SELECT id FROM ebd_clientes 
    WHERE superintendente_user_id = auth.uid()
  )
);

-- Add policy for superintendentes to view their church's addresses
CREATE POLICY "Superintendentes can view their church addresses"
ON public.ebd_endereco_entrega
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT id FROM ebd_clientes 
    WHERE superintendente_user_id = auth.uid()
  )
);

-- Add policy for superintendentes to update their church's addresses
CREATE POLICY "Superintendentes can update their church addresses"
ON public.ebd_endereco_entrega
FOR UPDATE
TO authenticated
USING (
  user_id IN (
    SELECT id FROM ebd_clientes 
    WHERE superintendente_user_id = auth.uid()
  )
)
WITH CHECK (
  user_id IN (
    SELECT id FROM ebd_clientes 
    WHERE superintendente_user_id = auth.uid()
  )
);

-- Add policy for superintendentes to delete their church's addresses
CREATE POLICY "Superintendentes can delete their church addresses"
ON public.ebd_endereco_entrega
FOR DELETE
TO authenticated
USING (
  user_id IN (
    SELECT id FROM ebd_clientes 
    WHERE superintendente_user_id = auth.uid()
  )
);