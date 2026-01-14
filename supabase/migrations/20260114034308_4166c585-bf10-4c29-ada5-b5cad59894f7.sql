-- Adicionar colunas nfe_id e status_nfe na tabela ebd_shopify_pedidos
ALTER TABLE public.ebd_shopify_pedidos 
ADD COLUMN IF NOT EXISTS nfe_id BIGINT,
ADD COLUMN IF NOT EXISTS status_nfe TEXT;

-- Comentário para documentar os valores possíveis
COMMENT ON COLUMN public.ebd_shopify_pedidos.status_nfe IS 'Status da NF-e: CRIADA, ENVIADA, PROCESSANDO, AUTORIZADA, REJEITADA';