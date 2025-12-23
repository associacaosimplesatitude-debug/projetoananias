-- Add order_date column to store actual Shopify order creation date
ALTER TABLE public.ebd_shopify_pedidos_cg 
ADD COLUMN IF NOT EXISTS order_date TIMESTAMP WITH TIME ZONE;

-- Add index for better filtering performance
CREATE INDEX IF NOT EXISTS idx_ebd_shopify_pedidos_cg_order_date 
ON public.ebd_shopify_pedidos_cg(order_date);