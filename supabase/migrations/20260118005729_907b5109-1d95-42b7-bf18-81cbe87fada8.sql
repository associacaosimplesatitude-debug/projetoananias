-- Add columns to store DANFE data directly in commission parcels
ALTER TABLE public.vendedor_propostas_parcelas
ADD COLUMN IF NOT EXISTS link_danfe TEXT,
ADD COLUMN IF NOT EXISTS nota_fiscal_numero TEXT;

-- Backfill existing data from ebd_shopify_pedidos where shopify_pedido_id exists
UPDATE public.vendedor_propostas_parcelas vpp
SET 
  link_danfe = esp.nota_fiscal_url,
  nota_fiscal_numero = esp.nota_fiscal_numero
FROM public.ebd_shopify_pedidos esp
WHERE vpp.shopify_pedido_id = esp.id
  AND vpp.link_danfe IS NULL
  AND esp.nota_fiscal_url IS NOT NULL;