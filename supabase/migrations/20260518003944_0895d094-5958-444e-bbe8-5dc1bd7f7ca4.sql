CREATE TABLE IF NOT EXISTS public.shopify_produto_pesos (
  sku text PRIMARY KEY,
  peso_bruto_kg numeric NOT NULL DEFAULT 0,
  peso_liquido_kg numeric NOT NULL DEFAULT 0,
  bling_product_id bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shopify_produto_pesos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read shopify_produto_pesos"
ON public.shopify_produto_pesos
FOR SELECT
TO authenticated
USING (true);