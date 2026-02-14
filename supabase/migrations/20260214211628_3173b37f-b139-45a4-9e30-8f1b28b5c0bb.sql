
-- Função para contar primeiras compras no funil (apenas contagem)
CREATE OR REPLACE FUNCTION public.get_primeira_compra_funil_count(
  p_vendedor_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM (
    SELECT customer_email, MIN(created_at) as primeira_compra
    FROM ebd_shopify_pedidos
    WHERE status_pagamento = 'paid'
      AND customer_email IS NOT NULL
      AND customer_email != ''
    GROUP BY customer_email
    HAVING MIN(created_at) >= '2025-12-01T00:00:00Z'
  ) first_buyers
  INNER JOIN LATERAL (
    SELECT vendedor_id
    FROM ebd_shopify_pedidos p2
    WHERE p2.customer_email = first_buyers.customer_email
      AND p2.created_at = first_buyers.primeira_compra
      AND p2.status_pagamento = 'paid'
    LIMIT 1
  ) pedido ON true
  WHERE (p_vendedor_id IS NULL OR pedido.vendedor_id = p_vendedor_id);
$$;

-- Função para listar primeiras compras no funil (dados expandidos)
CREATE OR REPLACE FUNCTION public.get_primeira_compra_funil_list(
  p_vendedor_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
  id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  valor_total NUMERIC,
  created_at TIMESTAMPTZ,
  vendedor_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.id,
    p.customer_name,
    p.customer_phone,
    p.customer_email,
    p.valor_total,
    p.created_at,
    p.vendedor_id
  FROM (
    SELECT customer_email AS email, MIN(created_at) AS primeira_compra
    FROM ebd_shopify_pedidos
    WHERE status_pagamento = 'paid'
      AND customer_email IS NOT NULL
      AND customer_email != ''
    GROUP BY customer_email
    HAVING MIN(created_at) >= '2025-12-01T00:00:00Z'
  ) first_buyers
  INNER JOIN ebd_shopify_pedidos p 
    ON p.customer_email = first_buyers.email
    AND p.created_at = first_buyers.primeira_compra
    AND p.status_pagamento = 'paid'
  WHERE (p_vendedor_id IS NULL OR p.vendedor_id = p_vendedor_id)
  ORDER BY p.created_at DESC
  LIMIT p_limit;
$$;
