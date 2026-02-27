ALTER TABLE public.ebd_shopify_pedidos_mercadopago 
ADD COLUMN IF NOT EXISTS sync_error TEXT,
ADD COLUMN IF NOT EXISTS sync_retries INT DEFAULT 0;