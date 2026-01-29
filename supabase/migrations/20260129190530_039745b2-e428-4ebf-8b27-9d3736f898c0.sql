-- Adicionar campos para rastreamento de pedidos Bling na tabela de vendas
ALTER TABLE public.royalties_vendas 
ADD COLUMN IF NOT EXISTS bling_order_id BIGINT DEFAULT NULL;

ALTER TABLE public.royalties_vendas 
ADD COLUMN IF NOT EXISTS bling_order_number TEXT DEFAULT NULL;

-- Índice único para evitar duplicatas na sincronização
CREATE UNIQUE INDEX IF NOT EXISTS idx_royalties_vendas_bling_unique 
ON public.royalties_vendas(bling_order_id, livro_id) 
WHERE bling_order_id IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.royalties_vendas.bling_order_id IS 'ID do pedido no Bling ERP';
COMMENT ON COLUMN public.royalties_vendas.bling_order_number IS 'Número do pedido no Bling ERP';