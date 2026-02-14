
CREATE OR REPLACE FUNCTION public.get_primeira_compra_funil_total(p_vendedor_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'count', COUNT(*)::integer,
    'total', COALESCE(SUM(p.valor_total), 0)
  )
  FROM (
    SELECT customer_email, MIN(created_at) as primeira_compra
    FROM ebd_shopify_pedidos
    WHERE status_pagamento = 'paid'
      AND customer_email IS NOT NULL
      AND customer_email != ''
    GROUP BY customer_email
    HAVING MIN(created_at) >= '2025-12-01T00:00:00Z'
  ) first_buyers
  INNER JOIN ebd_shopify_pedidos p 
    ON p.customer_email = first_buyers.customer_email
    AND p.created_at = first_buyers.primeira_compra
    AND p.status_pagamento = 'paid'
  WHERE (p_vendedor_id IS NULL OR p.vendedor_id = p_vendedor_id);
$$;
