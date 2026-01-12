-- Drop existing broken policies
DROP POLICY IF EXISTS "Vendedores podem ver suas visualizacoes" ON tutorial_visualizacoes;
DROP POLICY IF EXISTS "Vendedores podem inserir visualizacoes" ON tutorial_visualizacoes;

-- Create corrected SELECT policy using auth.jwt() instead of auth.users
CREATE POLICY "Vendedores podem ver suas visualizacoes" 
ON tutorial_visualizacoes 
FOR SELECT 
TO authenticated
USING (
  vendedor_id IN (
    SELECT id FROM vendedores 
    WHERE email = auth.jwt() ->> 'email'
  )
);

-- Create corrected INSERT policy using auth.jwt() instead of auth.users
CREATE POLICY "Vendedores podem inserir visualizacoes" 
ON tutorial_visualizacoes 
FOR INSERT 
TO authenticated
WITH CHECK (
  vendedor_id IN (
    SELECT id FROM vendedores 
    WHERE email = auth.jwt() ->> 'email'
  )
);