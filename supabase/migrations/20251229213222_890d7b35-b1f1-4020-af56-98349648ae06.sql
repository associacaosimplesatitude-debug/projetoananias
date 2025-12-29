-- Drop the existing limited policy
DROP POLICY IF EXISTS "Vendedores can view their own shopify pedidos" ON ebd_shopify_pedidos;

-- Create a new policy that allows vendedores to view pedidos by vendedor_id OR by cliente_id of their clients
CREATE POLICY "Vendedores can view shopify pedidos" 
ON ebd_shopify_pedidos 
FOR SELECT 
USING (
  -- By vendedor_id directly
  vendedor_id = get_vendedor_id_by_email(get_auth_email())
  OR
  -- By cliente_id of clients assigned to the vendedor
  cliente_id IN (
    SELECT id FROM ebd_clientes 
    WHERE vendedor_id = get_vendedor_id_by_email(get_auth_email())
  )
);