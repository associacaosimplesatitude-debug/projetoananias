
CREATE OR REPLACE FUNCTION public.get_publicos_revistas_por_mes()
RETURNS JSON
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  WITH revista_pedidos AS (
    SELECT DISTINCT ON (DATE_TRUNC('month', p.created_at), LOWER(TRIM(COALESCE(p.customer_email, ''))))
      DATE_TRUNC('month', p.created_at) AS mes,
      p.customer_name,
      p.customer_email,
      p.customer_phone,
      p.valor_total,
      p.created_at AS data_pedido,
      p.order_number,
      p.vendedor_id
    FROM ebd_shopify_pedidos p
    INNER JOIN ebd_shopify_pedidos_itens i ON i.pedido_id = p.id
    WHERE p.status_pagamento = 'paid'
      AND (
        LOWER(i.product_title) LIKE '%revista%'
        OR LOWER(i.product_title) LIKE '%ebd%'
        OR LOWER(i.product_title) LIKE '%estudo bíblico%'
        OR LOWER(i.product_title) LIKE '%estudo biblico%'
        OR LOWER(i.product_title) LIKE '%kit do professor%'
        OR LOWER(i.product_title) LIKE '%kit professor%'
        OR LOWER(i.product_title) LIKE '%infografico%'
      )
      AND p.customer_email IS NOT NULL
      AND p.customer_email != ''
    ORDER BY DATE_TRUNC('month', p.created_at), LOWER(TRIM(COALESCE(p.customer_email, ''))), p.created_at DESC
  ),
  produtos_por_contato AS (
    SELECT 
      DATE_TRUNC('month', p.created_at) AS mes,
      LOWER(TRIM(p.customer_email)) AS email_key,
      STRING_AGG(DISTINCT i.product_title, ', ' ORDER BY i.product_title) AS produtos
    FROM ebd_shopify_pedidos p
    INNER JOIN ebd_shopify_pedidos_itens i ON i.pedido_id = p.id
    WHERE p.status_pagamento = 'paid'
      AND (
        LOWER(i.product_title) LIKE '%revista%'
        OR LOWER(i.product_title) LIKE '%ebd%'
        OR LOWER(i.product_title) LIKE '%estudo bíblico%'
        OR LOWER(i.product_title) LIKE '%estudo biblico%'
        OR LOWER(i.product_title) LIKE '%kit do professor%'
        OR LOWER(i.product_title) LIKE '%kit professor%'
        OR LOWER(i.product_title) LIKE '%infografico%'
      )
      AND p.customer_email IS NOT NULL
      AND p.customer_email != ''
    GROUP BY DATE_TRUNC('month', p.created_at), LOWER(TRIM(p.customer_email))
  ),
  meses AS (
    SELECT 
      rp.mes,
      COUNT(*) AS total_contatos,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'customer_name', rp.customer_name,
          'customer_email', rp.customer_email,
          'customer_phone', rp.customer_phone,
          'valor_total', rp.valor_total,
          'data_pedido', rp.data_pedido,
          'order_number', rp.order_number,
          'vendedor_id', rp.vendedor_id,
          'produtos', ppc.produtos
        ) ORDER BY rp.customer_name
      ) AS contatos
    FROM revista_pedidos rp
    LEFT JOIN produtos_por_contato ppc 
      ON ppc.mes = rp.mes AND ppc.email_key = LOWER(TRIM(rp.customer_email))
    GROUP BY rp.mes
    ORDER BY rp.mes DESC
  )
  SELECT JSON_AGG(
    JSON_BUILD_OBJECT(
      'mes', m.mes,
      'total_contatos', m.total_contatos,
      'contatos', m.contatos
    )
  )
  FROM meses m
  INTO result;

  RETURN COALESCE(result, '[]'::json);
END;
$$;
