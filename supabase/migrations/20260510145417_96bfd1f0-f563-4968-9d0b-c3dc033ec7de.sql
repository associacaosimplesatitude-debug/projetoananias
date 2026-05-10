CREATE OR REPLACE FUNCTION public.historico_compras_completo(
  p_cliente_id uuid DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_limite int DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email,'')));
  v_vars text[] := public.variantes_telefone(p_telefone);
  v_resultado jsonb;
BEGIN
  WITH todos AS (
    SELECT
      'loja_atual_cg'::text AS origem, false AS arquivado,
      cast(id AS text) AS pedido_id, cliente_id, order_date AS data_pedido,
      coalesce(status_pagamento, status_pedido) AS status, valor_total,
      customer_email AS email, customer_phone AS telefone,
      codigo_rastreio, url_rastreio, paid_at, provisionamento_status
    FROM ebd_loja_pedidos_cg
    WHERE (p_cliente_id IS NOT NULL AND cliente_id = p_cliente_id)
       OR (array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(customer_phone,''),'[^0-9]','','g') = ANY(v_vars))
       OR (v_email <> '' AND lower(trim(customer_email)) = v_email)

    UNION ALL
    SELECT 'mp_standalone'::text, false,
      cast(id AS text), cliente_id, created_at,
      coalesce(payment_status, status), valor_total,
      cliente_email, cliente_telefone,
      null::text, null::text,
      CASE WHEN coalesce(payment_status,status) IN ('paid','approved','aprovado') THEN updated_at ELSE null END,
      null::text
    FROM ebd_shopify_pedidos_mercadopago
    WHERE (p_cliente_id IS NOT NULL AND cliente_id = p_cliente_id)
       OR (array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(cliente_telefone,''),'[^0-9]','','g') = ANY(v_vars))
       OR (v_email <> '' AND lower(trim(cliente_email)) = v_email)

    UNION ALL
    SELECT 'historico_shopify_ebd'::text, true,
      cast(id AS text), cliente_id, order_date,
      status_pagamento, valor_total,
      customer_email, customer_phone,
      codigo_rastreio, url_rastreio, null::timestamptz, null::text
    FROM ebd_shopify_pedidos
    WHERE (p_cliente_id IS NOT NULL AND cliente_id = p_cliente_id)
       OR (array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(customer_phone,''),'[^0-9]','','g') = ANY(v_vars))
       OR (v_email <> '' AND lower(trim(customer_email)) = v_email)

    UNION ALL
    SELECT 'historico_shopify_cg'::text, true,
      cast(id AS text), cliente_id, order_date,
      status_pagamento, valor_total,
      customer_email, endereco_telefone,
      codigo_rastreio, url_rastreio, null::timestamptz, null::text
    FROM ebd_shopify_pedidos_cg
    WHERE (p_cliente_id IS NOT NULL AND cliente_id = p_cliente_id)
       OR (v_email <> '' AND lower(trim(customer_email)) = v_email)

    UNION ALL
    SELECT 'proposta_b2b'::text, false,
      cast(id AS text), cliente_id, created_at,
      status, valor_total,
      null::text, null::text, null::text, null::text,
      confirmado_em, null::text
    FROM vendedor_propostas
    WHERE p_cliente_id IS NOT NULL AND cliente_id = p_cliente_id

    UNION ALL
    SELECT ('marketplace_' || coalesce(marketplace,'desconhecido'))::text, false,
      cast(id AS text), null::uuid, order_date,
      coalesce(status_pagamento, status_logistico), valor_total,
      customer_email, null::text,
      codigo_rastreio, url_rastreio, null::timestamptz, null::text
    FROM bling_marketplace_pedidos
    WHERE v_email <> '' AND lower(trim(customer_email)) = v_email

    UNION ALL
    SELECT 'pdv_balcao'::text, false,
      cast(id AS text), null::uuid, created_at,
      status, valor_total,
      null::text, cliente_telefone,
      null::text, null::text, null::timestamptz, null::text
    FROM vendas_balcao
    WHERE array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(cliente_telefone,''),'[^0-9]','','g') = ANY(v_vars)
  )
  SELECT jsonb_build_object(
    'total_encontrados', (SELECT count(*) FROM todos),
    'pedidos', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t.*))
       FROM (SELECT * FROM todos ORDER BY data_pedido DESC NULLS LAST LIMIT p_limite) t),
      '[]'::jsonb
    )
  ) INTO v_resultado;
  RETURN v_resultado;
END;
$$;