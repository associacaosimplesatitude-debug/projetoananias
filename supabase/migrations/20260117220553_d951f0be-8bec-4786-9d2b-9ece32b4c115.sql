-- Add comissao_aprovada column to ebd_shopify_pedidos
ALTER TABLE ebd_shopify_pedidos 
ADD COLUMN IF NOT EXISTS comissao_aprovada boolean DEFAULT false;

-- Add shopify_pedido_id FK to vendedor_propostas_parcelas for online orders
ALTER TABLE vendedor_propostas_parcelas 
ADD COLUMN IF NOT EXISTS shopify_pedido_id uuid REFERENCES ebd_shopify_pedidos(id);