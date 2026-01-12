-- Add Bling-related columns to ebd_shopify_pedidos
ALTER TABLE public.ebd_shopify_pedidos
ADD COLUMN IF NOT EXISTS bling_order_id bigint,
ADD COLUMN IF NOT EXISTS bling_status text,
ADD COLUMN IF NOT EXISTS bling_status_id integer,
ADD COLUMN IF NOT EXISTS nota_fiscal_numero text,
ADD COLUMN IF NOT EXISTS nota_fiscal_chave text,
ADD COLUMN IF NOT EXISTS nota_fiscal_url text,
ADD COLUMN IF NOT EXISTS codigo_rastreio_bling text;

-- Add index for bling_order_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_ebd_shopify_pedidos_bling_order_id 
ON public.ebd_shopify_pedidos(bling_order_id);