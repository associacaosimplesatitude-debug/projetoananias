-- Adicionar política para permitir visualização de lições globais (revistas do currículo)
CREATE POLICY "Todos podem visualizar licoes globais"
ON ebd_licoes
FOR SELECT
TO authenticated
USING (church_id IS NULL OR church_id IN (
  SELECT churches.id 
  FROM churches 
  WHERE churches.user_id = auth.uid()
));