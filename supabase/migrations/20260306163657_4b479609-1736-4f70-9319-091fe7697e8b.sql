
CREATE OR REPLACE FUNCTION public.get_publicos_revistas_por_mes()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      p.vendedor_id,
      p.cliente_id
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
  contatos_com_desconto AS (
    SELECT 
      rp.mes,
      rp.customer_name,
      rp.customer_email,
      rp.customer_phone,
      rp.valor_total,
      rp.data_pedido,
      rp.order_number,
      rp.vendedor_id,
      ppc.produtos,
      CASE WHEN dcr.id IS NOT NULL THEN true ELSE false END AS tem_desconto
    FROM revista_pedidos rp
    LEFT JOIN produtos_por_contato ppc 
      ON ppc.mes = rp.mes AND ppc.email_key = LOWER(TRIM(rp.customer_email))
    LEFT JOIN ebd_clientes ec 
      ON LOWER(TRIM(ec.email_superintendente)) = LOWER(TRIM(rp.customer_email))
    LEFT JOIN ebd_descontos_categoria_representante dcr 
      ON dcr.cliente_id = ec.id AND dcr.categoria = 'revistas'
  ),
  meses AS (
    SELECT 
      cd.mes,
      COUNT(*) AS total_contatos,
      COUNT(*) FILTER (WHERE cd.tem_desconto = true) AS com_desconto,
      COUNT(*) FILTER (WHERE cd.tem_desconto = false) AS sem_desconto,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'customer_name', cd.customer_name,
          'customer_email', cd.customer_email,
          'customer_phone', cd.customer_phone,
          'valor_total', cd.valor_total,
          'data_pedido', cd.data_pedido,
          'order_number', cd.order_number,
          'vendedor_id', cd.vendedor_id,
          'produtos', cd.produtos,
          'tem_desconto', cd.tem_desconto
        ) ORDER BY cd.customer_name
      ) AS contatos
    FROM contatos_com_desconto cd
    GROUP BY cd.mes
    ORDER BY cd.mes DESC
  )
  SELECT JSON_AGG(
    JSON_BUILD_OBJECT(
      'mes', m.mes,
      'total_contatos', m.total_contatos,
      'com_desconto', m.com_desconto,
      'sem_desconto', m.sem_desconto,
      'contatos', m.contatos
    )
  )
  FROM meses m
  INTO result;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;
