-- Adicionar colunas para sincronização de status do Bling
ALTER TABLE public.vendedor_propostas
ADD COLUMN IF NOT EXISTS bling_status TEXT,
ADD COLUMN IF NOT EXISTS bling_status_id INTEGER,
ADD COLUMN IF NOT EXISTS bling_synced_at TIMESTAMP WITH TIME ZONE;

-- Índice para buscar pedidos que precisam de sync
CREATE INDEX IF NOT EXISTS idx_vendedor_propostas_bling_sync 
ON public.vendedor_propostas (bling_order_id, bling_synced_at) 
WHERE bling_order_id IS NOT NULL;