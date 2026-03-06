
CREATE OR REPLACE FUNCTION public.get_pedidos_sem_itens(p_limit integer DEFAULT 15)
RETURNS TABLE(id uuid, shopify_order_id bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.shopify_order_id
  FROM ebd_shopify_pedidos p
  LEFT JOIN ebd_shopify_pedidos_itens i ON i.pedido_id = p.id
  WHERE p.status_pagamento = 'paid'
    AND p.shopify_order_id IS NOT NULL
    AND i.id IS NULL
  ORDER BY p.created_at ASC
  LIMIT p_limit;
$$;
