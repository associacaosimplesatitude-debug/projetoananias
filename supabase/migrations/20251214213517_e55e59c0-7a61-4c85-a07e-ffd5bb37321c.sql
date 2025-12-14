-- Add RLS policy for clients to view their own shopify orders
CREATE POLICY "Clients can view their own shopify pedidos"
ON ebd_shopify_pedidos
FOR SELECT
USING (
  cliente_id IN (
    SELECT id FROM ebd_clientes WHERE superintendente_user_id = auth.uid()
  )
);