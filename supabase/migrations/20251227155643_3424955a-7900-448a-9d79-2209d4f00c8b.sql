-- Ensure line items can be upserted by Shopify line item id
-- 1) Remove legacy/invalid rows that have null Shopify line item id
DELETE FROM public.ebd_shopify_pedidos_cg_itens
WHERE shopify_line_item_id IS NULL;

-- 2) Enforce NOT NULL so ON CONFLICT works reliably
ALTER TABLE public.ebd_shopify_pedidos_cg_itens
ALTER COLUMN shopify_line_item_id SET NOT NULL;

-- 3) Add a unique constraint used by the Edge Function upsert(onConflict)
ALTER TABLE public.ebd_shopify_pedidos_cg_itens
ADD CONSTRAINT ebd_shopify_pedidos_cg_itens_shopify_line_item_id_key
UNIQUE (shopify_line_item_id);

-- Helpful index for popup loading by pedido_id
CREATE INDEX IF NOT EXISTS idx_ebd_shopify_pedidos_cg_itens_pedido_id
ON public.ebd_shopify_pedidos_cg_itens (pedido_id);