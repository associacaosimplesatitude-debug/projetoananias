ALTER TABLE public.ebd_shopify_pedidos_cg
ADD COLUMN IF NOT EXISTS endereco_rua text,
ADD COLUMN IF NOT EXISTS endereco_numero text,
ADD COLUMN IF NOT EXISTS endereco_complemento text,
ADD COLUMN IF NOT EXISTS endereco_bairro text,
ADD COLUMN IF NOT EXISTS endereco_cidade text,
ADD COLUMN IF NOT EXISTS endereco_estado text,
ADD COLUMN IF NOT EXISTS endereco_cep text,
ADD COLUMN IF NOT EXISTS endereco_nome text,
ADD COLUMN IF NOT EXISTS endereco_telefone text;

CREATE INDEX IF NOT EXISTS idx_ebd_shopify_pedidos_cg_order_date ON public.ebd_shopify_pedidos_cg(order_date);
CREATE INDEX IF NOT EXISTS idx_ebd_shopify_pedidos_cg_customer_email ON public.ebd_shopify_pedidos_cg(customer_email);