-- Add order_date column to ebd_shopify_pedidos table to store real Shopify order date
ALTER TABLE public.ebd_shopify_pedidos
ADD COLUMN IF NOT EXISTS order_date TIMESTAMP WITH TIME ZONE;

-- Create index for better filtering performance
CREATE INDEX IF NOT EXISTS idx_ebd_shopify_pedidos_order_date 
ON public.ebd_shopify_pedidos(order_date);

-- Update existing rows to populate order_date from created_at
UPDATE public.ebd_shopify_pedidos
SET order_date = created_at
WHERE order_date IS NULL;