-- Remover constraint única de bling_order_id (está causando conflitos)
ALTER TABLE public.bling_marketplace_pedidos DROP CONSTRAINT IF EXISTS bling_marketplace_pedidos_bling_order_id_key;

-- Criar índice único composto para order_number + marketplace
CREATE UNIQUE INDEX IF NOT EXISTS idx_bling_marketplace_pedidos_order_marketplace 
ON public.bling_marketplace_pedidos (order_number, marketplace);