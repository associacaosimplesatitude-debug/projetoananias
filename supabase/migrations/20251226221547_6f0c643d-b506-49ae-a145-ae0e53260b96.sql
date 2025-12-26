-- Add RLS policies for financeiro role to access sales data

-- ebd_shopify_pedidos - Allow financeiro to SELECT
CREATE POLICY "Financeiro can select ebd_shopify_pedidos"
ON public.ebd_shopify_pedidos
FOR SELECT
USING (has_role(auth.uid(), 'financeiro'::app_role));

-- ebd_shopify_pedidos_cg - Allow financeiro to SELECT
CREATE POLICY "Financeiro can select cg pedidos"
ON public.ebd_shopify_pedidos_cg
FOR SELECT
USING (has_role(auth.uid(), 'financeiro'::app_role));

-- bling_marketplace_pedidos - Allow financeiro to SELECT
CREATE POLICY "Financeiro can select marketplace pedidos"
ON public.bling_marketplace_pedidos
FOR SELECT
USING (has_role(auth.uid(), 'financeiro'::app_role));