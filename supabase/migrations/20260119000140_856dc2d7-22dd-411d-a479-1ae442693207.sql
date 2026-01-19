-- Adicionar coluna comissao_aprovada na tabela ebd_shopify_pedidos
ALTER TABLE public.ebd_shopify_pedidos 
ADD COLUMN IF NOT EXISTS comissao_aprovada boolean DEFAULT false;