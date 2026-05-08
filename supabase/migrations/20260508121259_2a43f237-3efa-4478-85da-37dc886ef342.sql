-- Fix: usar security_invoker para a view não ser SECURITY DEFINER
DROP VIEW IF EXISTS public.pedidos_cliente_360;
CREATE VIEW public.pedidos_cliente_360
WITH (security_invoker = true) AS
SELECT cliente_id, id::text AS pedido_id, 'historico_shopify_ebd' AS origem, arquivada AS arquivado,
  created_at AS data_pedido, status_pagamento, valor_total, customer_email AS email, customer_phone AS telefone
FROM public.ebd_shopify_pedidos
UNION ALL
SELECT cliente_id, id::text, 'historico_shopify_cg', arquivada, created_at, status_pagamento, valor_total, customer_email, NULL::text
FROM public.ebd_shopify_pedidos_cg
UNION ALL
SELECT cliente_id, id::text, 'mp_standalone_ativo', arquivada, created_at, status, valor_total, cliente_email, cliente_telefone
FROM public.ebd_shopify_pedidos_mercadopago
UNION ALL
SELECT cliente_id, id::text, 'loja_atual_cg', false, created_at, status_pagamento, valor_total, customer_email, customer_phone
FROM public.ebd_loja_pedidos_cg;

COMMENT ON VIEW public.pedidos_cliente_360 IS
  'View consolidada de pedidos do cliente em todas as fontes (4 tabelas). Coluna origem identifica fonte; arquivado=true indica registro histórico de loja Shopify cancelada. SECURITY INVOKER (respeita RLS do consumidor).';