-- Adicionar campo para armazenar o ID do pedido no Bling
ALTER TABLE public.ebd_pedidos 
ADD COLUMN IF NOT EXISTS bling_order_id BIGINT DEFAULT NULL;