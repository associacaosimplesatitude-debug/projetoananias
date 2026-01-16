-- Adicionar coluna proposta_id para rastreio direto por UUID
ALTER TABLE public.ebd_shopify_pedidos_mercadopago 
ADD COLUMN IF NOT EXISTS proposta_id UUID NULL;

-- Adicionar índice para buscas por proposta_id
CREATE INDEX IF NOT EXISTS idx_ebd_shopify_pedidos_mp_proposta_id 
ON public.ebd_shopify_pedidos_mercadopago(proposta_id);