-- Criar tabela para armazenar os itens dos pedidos Shopify (EBD)
CREATE TABLE public.ebd_shopify_pedidos_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.ebd_shopify_pedidos(id) ON DELETE CASCADE,
  shopify_line_item_id BIGINT NOT NULL,
  product_title TEXT NOT NULL,
  variant_title TEXT,
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(pedido_id, shopify_line_item_id)
);

-- Habilitar RLS
ALTER TABLE public.ebd_shopify_pedidos_itens ENABLE ROW LEVEL SECURITY;

-- Política para leitura - qualquer usuário autenticado pode ver (a filtragem é feita pelo pedido)
CREATE POLICY "Authenticated users can view pedido items"
ON public.ebd_shopify_pedidos_itens
FOR SELECT
TO authenticated
USING (true);

-- Índice para performance
CREATE INDEX idx_ebd_shopify_pedidos_itens_pedido_id ON public.ebd_shopify_pedidos_itens(pedido_id);