-- Adicionar coluna proposta_token se não existir
ALTER TABLE public.ebd_shopify_pedidos_mercadopago 
ADD COLUMN IF NOT EXISTS proposta_token TEXT;