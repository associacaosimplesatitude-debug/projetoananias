-- Add tracking columns to ebd_shopify_pedidos table
ALTER TABLE public.ebd_shopify_pedidos
ADD COLUMN IF NOT EXISTS codigo_rastreio text,
ADD COLUMN IF NOT EXISTS url_rastreio text;