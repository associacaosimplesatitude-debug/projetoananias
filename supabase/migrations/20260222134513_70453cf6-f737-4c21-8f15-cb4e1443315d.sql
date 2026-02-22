
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
        'valor', COALESCE(SUM(valor_total), 0),
        'qtd', COUNT(*)
      )
      FROM ebd_shopify_pedidos_cg
      WHERE status_pagamento IN ('paid', 'Pago', 'Faturado')
        AND created_at >= v_start
        AND created_at < v_end
    ),
    
    'igreja_cnpj', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(total), 0),
        'qtd', COALESCE(SUM(cnt), 0)::int
      )
      FROM (
        SELECT COALESCE(SUM(esp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos esp
        LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
        WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
          AND esp.created_at >= v_start
          AND esp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%IGREJA%CNPJ%'
        UNION ALL
        SELECT COALESCE(SUM(mp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos_mercadopago mp
        LEFT JOIN ebd_clientes ec ON mp.cliente_id = ec.id
        WHERE mp.status = 'PAGO'
          AND mp.created_at >= v_start
          AND mp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%IGREJA%CNPJ%'
      ) combined
    ),
    
    'igreja_cpf', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(total), 0),
        'qtd', COALESCE(SUM(cnt), 0)::int
      )
      FROM (
        SELECT COALESCE(SUM(esp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos esp
        LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
        WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
          AND esp.created_at >= v_start
          AND esp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%IGREJA%CPF%'
        UNION ALL
        SELECT COALESCE(SUM(mp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos_mercadopago mp
        LEFT JOIN ebd_clientes ec ON mp.cliente_id = ec.id
        WHERE mp.status = 'PAGO'
          AND mp.created_at >= v_start
          AND mp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%IGREJA%CPF%'
      ) combined
    ),
    
    'lojistas', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(total), 0),
        'qtd', COALESCE(SUM(cnt), 0)::int
      )
      FROM (
        SELECT COALESCE(SUM(esp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos esp
        LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
        WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
          AND esp.created_at >= v_start
          AND esp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%LOJISTA%'
        UNION ALL
        SELECT COALESCE(SUM(mp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos_mercadopago mp
        LEFT JOIN ebd_clientes ec ON mp.cliente_id = ec.id
        WHERE mp.status = 'PAGO'
          AND mp.created_at >= v_start
          AND mp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%LOJISTA%'
      ) combined
    ),
    
    'pessoa_fisica', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(total), 0),
        'qtd', COALESCE(SUM(cnt), 0)::int
      )
      FROM (
        SELECT COALESCE(SUM(esp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos esp
        LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
        WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
          AND esp.created_at >= v_start
          AND esp.created_at < v_end
          AND (UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%PESSOA%' 
               OR UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%FISICA%'
               OR UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%PF%')
        UNION ALL
        SELECT COALESCE(SUM(mp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos_mercadopago mp
        LEFT JOIN ebd_clientes ec ON mp.cliente_id = ec.id
        WHERE mp.status = 'PAGO'
          AND mp.created_at >= v_start
          AND mp.created_at < v_end
          AND (UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%PESSOA%' 
               OR UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%FISICA%'
               OR UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%PF%')
      ) combined
    ),
    
    'igrejas_total', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(total), 0),
        'qtd', COALESCE(SUM(cnt), 0)::int
      )
      FROM (
        SELECT COALESCE(SUM(valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos
        WHERE status_pagamento IN ('Pago', 'paid', 'Faturado')
          AND created_at >= v_start
          AND created_at < v_end
        UNION ALL
        SELECT COALESCE(SUM(valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos_mercadopago
        WHERE status = 'PAGO'
          AND created_at >= v_start
          AND created_at < v_end
      ) combined
    ),
    
    'advecs', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(total), 0),
        'qtd', COALESCE(SUM(cnt), 0)::int
      )
      FROM (
        SELECT COALESCE(SUM(valor_total), 0) as total, COUNT(*) as cnt
        FROM bling_marketplace_pedidos
        WHERE marketplace = 'ADVECS'
          AND order_date >= v_start
          AND order_date < v_end
        UNION ALL
        SELECT COALESCE(SUM(esp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos esp
        LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
        WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
          AND esp.created_at >= v_start
          AND esp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%ADVEC%'
        UNION ALL
        SELECT COALESCE(SUM(mp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos_mercadopago mp
        LEFT JOIN ebd_clientes ec ON mp.cliente_id = ec.id
        WHERE mp.status = 'PAGO'
          AND mp.created_at >= v_start
          AND mp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%ADVEC%'
      ) combined
    ),
    
    'amazon', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(valor_total), 0),
        'qtd', COUNT(*)
      )
      FROM bling_marketplace_pedidos
      WHERE marketplace = 'AMAZON'
        AND order_date >= v_start
        AND order_date < v_end
    ),
    
    'shopee', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(valor_total), 0),
        'qtd', COUNT(*)
      )
      FROM bling_marketplace_pedidos
      WHERE marketplace = 'SHOPEE'
        AND order_date >= v_start
        AND order_date < v_end
    ),
    
    'mercado_livre', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(valor_total), 0),
        'qtd', COUNT(*)
      )
      FROM bling_marketplace_pedidos
      WHERE marketplace = 'MERCADO_LIVRE'
        AND order_date >= v_start
        AND order_date < v_end
    ),
    
    'atacado', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(valor_total), 0),
        'qtd', COUNT(*)
      )
      FROM bling_marketplace_pedidos
      WHERE marketplace = 'ATACADO'
        AND order_date >= v_start
        AND order_date < v_end
    ),
    
    'propostas_advecs', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(vp.valor_total - COALESCE(vp.valor_frete, 0)), 0),
        'qtd', COUNT(*)
      )
      FROM vendedor_propostas vp
      LEFT JOIN ebd_clientes ec ON vp.cliente_id = ec.id
      WHERE vp.status IN ('FATURADO', 'PAGO')
        AND vp.created_at >= v_start
        AND vp.created_at < v_end
        AND ec.tipo_cliente = 'Igreja'
    ),
    
    'propostas_revendedores', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(total), 0),
        'qtd', COALESCE(SUM(cnt), 0)::int
      )
      FROM (
        SELECT COALESCE(SUM(vp.valor_total - COALESCE(vp.valor_frete, 0)), 0) as total, COUNT(*) as cnt
        FROM vendedor_propostas vp
        LEFT JOIN ebd_clientes ec ON vp.cliente_id = ec.id
        WHERE vp.status IN ('FATURADO', 'PAGO')
          AND vp.created_at >= v_start
          AND vp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%REVENDEDOR%'
        UNION ALL
        SELECT COALESCE(SUM(esp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos esp
        LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
        WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
          AND esp.created_at >= v_start
          AND esp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%REVENDEDOR%'
        UNION ALL
        SELECT COALESCE(SUM(mp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos_mercadopago mp
        LEFT JOIN ebd_clientes ec ON mp.cliente_id = ec.id
        WHERE mp.status = 'PAGO'
          AND mp.created_at >= v_start
          AND mp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%REVENDEDOR%'
      ) combined
    ),
    
    'propostas_representantes', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(total), 0),
        'qtd', COALESCE(SUM(cnt), 0)::int
      )
      FROM (
        SELECT COALESCE(SUM(vp.valor_total - COALESCE(vp.valor_frete, 0)), 0) as total, COUNT(*) as cnt
        FROM vendedor_propostas vp
        LEFT JOIN ebd_clientes ec ON vp.cliente_id = ec.id
        WHERE vp.status IN ('FATURADO', 'PAGO')
          AND vp.created_at >= v_start
          AND vp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%REPRESENTANTE%'
        UNION ALL
        SELECT COALESCE(SUM(esp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos esp
        LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
        WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
          AND esp.created_at >= v_start
          AND esp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%REPRESENTANTE%'
        UNION ALL
        SELECT COALESCE(SUM(mp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos_mercadopago mp
        LEFT JOIN ebd_clientes ec ON mp.cliente_id = ec.id
        WHERE mp.status = 'PAGO'
          AND mp.created_at >= v_start
          AND mp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%REPRESENTANTE%'
      ) combined
    ),

    -- NOVO: PDV Balcão (vendas no balcão da loja Penha)
    'pdv_balcao', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(valor_total), 0),
        'qtd', COUNT(*)
      )
      FROM vendas_balcao
      WHERE status = 'finalizada'
        AND created_at >= v_start
        AND created_at < v_end
    )
  ) INTO result;

  RETURN result;
END;
$function$;
