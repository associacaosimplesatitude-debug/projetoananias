-- Add commission approval columns to ebd_shopify_pedidos_cg
ALTER TABLE public.ebd_shopify_pedidos_cg
ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES public.vendedores(id),
ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.ebd_clientes(id),
ADD COLUMN IF NOT EXISTS comissao_aprovada boolean DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_ebd_shopify_pedidos_cg_vendedor_id ON public.ebd_shopify_pedidos_cg(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_ebd_shopify_pedidos_cg_cliente_id ON public.ebd_shopify_pedidos_cg(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ebd_shopify_pedidos_cg_comissao_aprovada ON public.ebd_shopify_pedidos_cg(comissao_aprovada);