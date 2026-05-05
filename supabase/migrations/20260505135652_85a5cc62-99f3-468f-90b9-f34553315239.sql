CREATE OR REPLACE FUNCTION public.get_sales_channel_totals(p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  IF p_start_date IS NULL THEN
    v_start := CURRENT_DATE::timestamptz;
  ELSE
    v_start := p_start_date;
  END IF;

  IF p_end_date IS NULL THEN
    v_end := (CURRENT_DATE + INTERVAL '1 day')::timestamptz;
  ELSE
    v_end := p_end_date;
  END IF;

  SELECT json_build_object(
    'ecommerce', (
      SELECT json_build_object(
        'valor',   COALESCE(SUM(valor_total), 0),
        'qtd',     COUNT(*)::int,
        'frete',   COALESCE(SUM(valor_frete), 0),
        'liquido', COALESCE(SUM(valor_total) - SUM(valor_frete), 0)
      )
      FROM (
        SELECT valor_total, COALESCE(valor_frete, 0) AS valor_frete
        FROM ebd_shopify_pedidos
        WHERE status_pagamento IN ('paid', 'Pago', 'Faturado')
          AND created_at >= v_start AND created_at < v_end
          AND (order_number IS NULL OR order_number NOT ILIKE 'BLING-%')
        UNION ALL
        SELECT valor_total, COALESCE(valor_frete, 0) AS valor_frete
        FROM ebd_loja_pedidos_cg
        WHERE status_pagamento = 'paid'
          AND created_at >= v_start AND created_at < v_end
      ) ecom
    ),

    'igreja_cnpj', (
      SELECT json_build_object('valor', COALESCE(SUM(total), 0), 'qtd', COALESCE(SUM(cnt), 0)::int)
      FROM (
        SELECT COALESCE(SUM(esp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos esp LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
        WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
          AND esp.created_at >= v_start AND esp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%IGREJA%CNPJ%'
        UNION ALL
        SELECT COALESCE(SUM(mp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos_mercadopago mp LEFT JOIN ebd_clientes ec ON mp.cliente_id = ec.id
        WHERE mp.status = 'PAGO' AND mp.created_at >= v_start AND mp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%IGREJA%CNPJ%'
      ) combined
    ),

    'igreja_cpf', (
      SELECT json_build_object('valor', COALESCE(SUM(total), 0), 'qtd', COALESCE(SUM(cnt), 0)::int)
      FROM (
        SELECT COALESCE(SUM(esp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos esp LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
        WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
          AND esp.created_at >= v_start AND esp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%IGREJA%CPF%'
        UNION ALL
        SELECT COALESCE(SUM(mp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos_mercadopago mp LEFT JOIN ebd_clientes ec ON mp.cliente_id = ec.id
        WHERE mp.status = 'PAGO' AND mp.created_at >= v_start AND mp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%IGREJA%CPF%'
      ) combined
    ),

    'lojistas', (
      SELECT json_build_object('valor', COALESCE(SUM(total), 0), 'qtd', COALESCE(SUM(cnt), 0)::int)
      FROM (
        SELECT COALESCE(SUM(esp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos esp LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
        WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
          AND esp.created_at >= v_start AND esp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%LOJISTA%'
        UNION ALL
        SELECT COALESCE(SUM(mp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos_mercadopago mp LEFT JOIN ebd_clientes ec ON mp.cliente_id = ec.id
        WHERE mp.status = 'PAGO' AND mp.created_at >= v_start AND mp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%LOJISTA%'
      ) combined
    ),

    'pessoa_fisica', (
      SELECT json_build_object('valor', COALESCE(SUM(total), 0), 'qtd', COALESCE(SUM(cnt), 0)::int)
      FROM (
        SELECT COALESCE(SUM(esp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos esp LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
        WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
          AND esp.created_at >= v_start AND esp.created_at < v_end
          AND (UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%PESSOA%'
               OR UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%FISICA%'
               OR UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%FÍSICA%')
        UNION ALL
        SELECT COALESCE(SUM(mp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos_mercadopago mp LEFT JOIN ebd_clientes ec ON mp.cliente_id = ec.id
        WHERE mp.status = 'PAGO' AND mp.created_at >= v_start AND mp.created_at < v_end
          AND (UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%PESSOA%'
               OR UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%FISICA%'
               OR UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%FÍSICA%')
      ) combined
    ),

    'igrejas_total', (
      SELECT json_build_object('valor', COALESCE(SUM(total), 0), 'qtd', COALESCE(SUM(cnt), 0)::int)
      FROM (
        SELECT COALESCE(SUM(esp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos esp LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
        WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
          AND esp.created_at >= v_start AND esp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%IGREJA%'
        UNION ALL
        SELECT COALESCE(SUM(mp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos_mercadopago mp LEFT JOIN ebd_clientes ec ON mp.cliente_id = ec.id
        WHERE mp.status = 'PAGO' AND mp.created_at >= v_start AND mp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%IGREJA%'
      ) combined
    ),

    'amazon', (
      SELECT json_build_object('valor', COALESCE(SUM(valor_total), 0), 'qtd', COUNT(*)::int)
      FROM ebd_marketplace_pedidos
      WHERE marketplace = 'amazon' AND created_at >= v_start AND created_at < v_end
    ),

    'shopee', (
      SELECT json_build_object('valor', COALESCE(SUM(valor_total), 0), 'qtd', COUNT(*)::int)
      FROM ebd_marketplace_pedidos
      WHERE marketplace = 'shopee' AND created_at >= v_start AND created_at < v_end
    ),

    'mercado_livre', (
      SELECT json_build_object('valor', COALESCE(SUM(valor_total), 0), 'qtd', COUNT(*)::int)
      FROM ebd_marketplace_pedidos
      WHERE marketplace = 'mercado_livre' AND created_at >= v_start AND created_at < v_end
    ),

    'advecs', (
      SELECT json_build_object('valor', COALESCE(SUM(valor_total), 0), 'qtd', COUNT(*)::int)
      FROM ebd_marketplace_pedidos
      WHERE marketplace = 'advecs' AND created_at >= v_start AND created_at < v_end
    ),

    'atacado', (
      SELECT json_build_object('valor', COALESCE(SUM(valor_total), 0), 'qtd', COUNT(*)::int)
      FROM ebd_marketplace_pedidos
      WHERE marketplace = 'atacado' AND created_at >= v_start AND created_at < v_end
    ),

    'propostas_advecs', (
      SELECT json_build_object('valor', COALESCE(SUM(p.valor_total), 0), 'qtd', COUNT(*)::int)
      FROM ebd_propostas p
      LEFT JOIN ebd_clientes ec ON p.cliente_id = ec.id
      WHERE p.status = 'faturada'
        AND p.created_at >= v_start AND p.created_at < v_end
        AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%ADVEC%'
    ),

    'propostas_revendedores', (
      SELECT json_build_object('valor', COALESCE(SUM(p.valor_total), 0), 'qtd', COUNT(*)::int)
      FROM ebd_propostas p
      LEFT JOIN ebd_clientes ec ON p.cliente_id = ec.id
      WHERE p.status = 'faturada'
        AND p.created_at >= v_start AND p.created_at < v_end
        AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%REVENDEDOR%'
    ),

    'propostas_representantes', (
      SELECT json_build_object('valor', COALESCE(SUM(p.valor_total), 0), 'qtd', COUNT(*)::int)
      FROM ebd_propostas p
      LEFT JOIN ebd_clientes ec ON p.cliente_id = ec.id
      WHERE p.status = 'faturada'
        AND p.created_at >= v_start AND p.created_at < v_end
        AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%REPRESENTANTE%'
    ),

    'pdv_balcao', (
      SELECT json_build_object('valor', COALESCE(SUM(valor_total), 0), 'qtd', COUNT(*)::int)
      FROM ebd_pdv_vendas
      WHERE status = 'concluida' AND created_at >= v_start AND created_at < v_end
    )
  ) INTO result;

  RETURN result;
END;
$function$;