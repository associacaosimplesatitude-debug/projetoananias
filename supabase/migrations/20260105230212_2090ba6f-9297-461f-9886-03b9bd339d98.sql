-- Add shopify_cancelled_at column to track cancelled orders
ALTER TABLE public.ebd_shopify_pedidos 
ADD COLUMN IF NOT EXISTS shopify_cancelled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;