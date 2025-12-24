-- Remove a constraint existente do campo marketplace
ALTER TABLE public.bling_marketplace_pedidos DROP CONSTRAINT IF EXISTS bling_marketplace_pedidos_marketplace_check;

-- Adicionar nova constraint com os valores ADVECS e ATACADO
ALTER TABLE public.bling_marketplace_pedidos ADD CONSTRAINT bling_marketplace_pedidos_marketplace_check 
CHECK (marketplace IN ('AMAZON', 'SHOPEE', 'MERCADO_LIVRE', 'ADVECS', 'ATACADO'));