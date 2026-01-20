-- Adicionar coluna mp_pedido_id para vincular comissão ao pedido MP
ALTER TABLE public.vendedor_propostas_parcelas
ADD COLUMN IF NOT EXISTS mp_pedido_id UUID REFERENCES public.ebd_shopify_pedidos_mercadopago(id);

-- Unique index para prevenir comissões duplicadas para o mesmo pedido MP
CREATE UNIQUE INDEX IF NOT EXISTS idx_parcelas_mp_pedido_unique 
ON public.vendedor_propostas_parcelas(mp_pedido_id) 
WHERE mp_pedido_id IS NOT NULL;

-- Index para buscas por mp_pedido_id
CREATE INDEX IF NOT EXISTS idx_parcelas_mp_pedido_id 
ON public.vendedor_propostas_parcelas(mp_pedido_id);