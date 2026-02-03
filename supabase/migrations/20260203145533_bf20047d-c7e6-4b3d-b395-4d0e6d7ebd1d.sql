-- Atualiza função RPC para incluir ebd_shopify_pedidos_mercadopago e Pessoa Física
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
  -- Se datas não fornecidas, usa o dia de hoje
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
    -- E-commerce (ebd_shopify_pedidos_cg)
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
    
    -- Igreja CNPJ (ebd_shopify_pedidos + ebd_shopify_pedidos_mercadopago com tipo_cliente IGREJA CNPJ)
    'igreja_cnpj', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(total), 0),
        'qtd', COALESCE(SUM(cnt), 0)::int
      )
      FROM (
        -- Pedidos normais
        SELECT COALESCE(SUM(esp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos esp
        LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
        WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
          AND esp.created_at >= v_start
          AND esp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%IGREJA%CNPJ%'
        UNION ALL
        -- Pedidos Mercado Pago
        SELECT COALESCE(SUM(mp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos_mercadopago mp
        LEFT JOIN ebd_clientes ec ON mp.cliente_id = ec.id
        WHERE mp.status = 'PAGO'
          AND mp.created_at >= v_start
          AND mp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%IGREJA%CNPJ%'
      ) combined
    ),
    
    -- Igreja CPF (ebd_shopify_pedidos + ebd_shopify_pedidos_mercadopago com tipo_cliente IGREJA CPF)
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
    
    -- Lojistas (ebd_shopify_pedidos + ebd_shopify_pedidos_mercadopago com tipo_cliente LOJISTA)
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
    
    -- Pessoa Física (NOVO CARD - ebd_shopify_pedidos + ebd_shopify_pedidos_mercadopago)
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
    
    -- Total Igrejas/Pedidos Gerais (todos os pedidos pagos de ambas as tabelas)
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
    
    -- ADVECS (bling_marketplace + pedidos + mercado pago com tipo ADVEC)
    'advecs', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(total), 0),
        'qtd', COALESCE(SUM(cnt), 0)::int
      )
      FROM (
        -- Bling marketplace ADVECS
        SELECT COALESCE(SUM(valor_total), 0) as total, COUNT(*) as cnt
        FROM bling_marketplace_pedidos
        WHERE marketplace = 'ADVECS'
          AND order_date >= v_start
          AND order_date < v_end
        UNION ALL
        -- Pedidos normais com tipo ADVEC
        SELECT COALESCE(SUM(esp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos esp
        LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
        WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
          AND esp.created_at >= v_start
          AND esp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%ADVEC%'
        UNION ALL
        -- Pedidos Mercado Pago com tipo ADVEC
        SELECT COALESCE(SUM(mp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos_mercadopago mp
        LEFT JOIN ebd_clientes ec ON mp.cliente_id = ec.id
        WHERE mp.status = 'PAGO'
          AND mp.created_at >= v_start
          AND mp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%ADVEC%'
      ) combined
    ),
    
    -- Amazon (bling_marketplace_pedidos)
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
    
    -- Shopee
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
    
    -- Mercado Livre
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
    
    -- Atacado
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
    
    -- Propostas ADVECS (tipo_cliente = 'Igreja')
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
    
    -- Propostas Revendedores (tipo_cliente LIKE '%REVENDEDOR%')
    'propostas_revendedores', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(total), 0),
        'qtd', COALESCE(SUM(cnt), 0)::int
      )
      FROM (
        -- Propostas
        SELECT COALESCE(SUM(vp.valor_total - COALESCE(vp.valor_frete, 0)), 0) as total, COUNT(*) as cnt
        FROM vendedor_propostas vp
        LEFT JOIN ebd_clientes ec ON vp.cliente_id = ec.id
        WHERE vp.status IN ('FATURADO', 'PAGO')
          AND vp.created_at >= v_start
          AND vp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%REVENDEDOR%'
        UNION ALL
        -- Pedidos normais
        SELECT COALESCE(SUM(esp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos esp
        LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
        WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
          AND esp.created_at >= v_start
          AND esp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%REVENDEDOR%'
        UNION ALL
        -- Pedidos Mercado Pago
        SELECT COALESCE(SUM(mp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos_mercadopago mp
        LEFT JOIN ebd_clientes ec ON mp.cliente_id = ec.id
        WHERE mp.status = 'PAGO'
          AND mp.created_at >= v_start
          AND mp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%REVENDEDOR%'
      ) combined
    ),
    
    -- Propostas Representantes (tipo_cliente LIKE '%REPRESENTANTE%')
    'propostas_representantes', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(total), 0),
        'qtd', COALESCE(SUM(cnt), 0)::int
      )
      FROM (
        -- Propostas
        SELECT COALESCE(SUM(vp.valor_total - COALESCE(vp.valor_frete, 0)), 0) as total, COUNT(*) as cnt
        FROM vendedor_propostas vp
        LEFT JOIN ebd_clientes ec ON vp.cliente_id = ec.id
        WHERE vp.status IN ('FATURADO', 'PAGO')
          AND vp.created_at >= v_start
          AND vp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%REPRESENTANTE%'
        UNION ALL
        -- Pedidos normais
        SELECT COALESCE(SUM(esp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos esp
        LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
        WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
          AND esp.created_at >= v_start
          AND esp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%REPRESENTANTE%'
        UNION ALL
        -- Pedidos Mercado Pago
        SELECT COALESCE(SUM(mp.valor_total), 0) as total, COUNT(*) as cnt
        FROM ebd_shopify_pedidos_mercadopago mp
        LEFT JOIN ebd_clientes ec ON mp.cliente_id = ec.id
        WHERE mp.status = 'PAGO'
          AND mp.created_at >= v_start
          AND mp.created_at < v_end
          AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%REPRESENTANTE%'
      ) combined
    )
  ) INTO result;

  RETURN result;
END;
$function$;