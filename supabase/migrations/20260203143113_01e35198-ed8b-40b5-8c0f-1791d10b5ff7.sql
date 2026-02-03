-- Função RPC para calcular totais dos canais de vendas
-- Evita o limite de 1000 registros do Supabase fazendo agregação no banco
CREATE OR REPLACE FUNCTION get_sales_channel_totals(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
    
    -- Igreja CNPJ (ebd_shopify_pedidos com tipo_cliente IGREJA + CNPJ)
    'igreja_cnpj', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(esp.valor_total), 0),
        'qtd', COUNT(*)
      )
      FROM ebd_shopify_pedidos esp
      LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
      WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
        AND esp.created_at >= v_start
        AND esp.created_at < v_end
        AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%IGREJA%CNPJ%'
    ),
    
    -- Igreja CPF (ebd_shopify_pedidos com tipo_cliente IGREJA + CPF)
    'igreja_cpf', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(esp.valor_total), 0),
        'qtd', COUNT(*)
      )
      FROM ebd_shopify_pedidos esp
      LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
      WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
        AND esp.created_at >= v_start
        AND esp.created_at < v_end
        AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%IGREJA%CPF%'
    ),
    
    -- Lojistas (ebd_shopify_pedidos com tipo_cliente LOJISTA)
    'lojistas', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(esp.valor_total), 0),
        'qtd', COUNT(*)
      )
      FROM ebd_shopify_pedidos esp
      LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
      WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
        AND esp.created_at >= v_start
        AND esp.created_at < v_end
        AND UPPER(COALESCE(ec.tipo_cliente, '')) LIKE '%LOJISTA%'
    ),
    
    -- Total Igrejas (todos os pedidos ebd_shopify_pedidos pagos)
    'igrejas_total', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(valor_total), 0),
        'qtd', COUNT(*)
      )
      FROM ebd_shopify_pedidos
      WHERE status_pagamento IN ('Pago', 'paid', 'Faturado')
        AND created_at >= v_start
        AND created_at < v_end
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
    
    -- ADVECS (bling_marketplace_pedidos + propostas faturadas tipo Igreja)
    'advecs', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(valor_total), 0),
        'qtd', COUNT(*)
      )
      FROM bling_marketplace_pedidos
      WHERE marketplace = 'ADVECS'
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
    
    -- Propostas Revendedores (tipo_cliente = 'Revendedor')
    'propostas_revendedores', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(vp.valor_total - COALESCE(vp.valor_frete, 0)), 0),
        'qtd', COUNT(*)
      )
      FROM vendedor_propostas vp
      LEFT JOIN ebd_clientes ec ON vp.cliente_id = ec.id
      WHERE vp.status IN ('FATURADO', 'PAGO')
        AND vp.created_at >= v_start
        AND vp.created_at < v_end
        AND ec.tipo_cliente = 'Revendedor'
    ),
    
    -- Propostas Representantes (tipo_cliente = 'Representante')
    'propostas_representantes', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(vp.valor_total - COALESCE(vp.valor_frete, 0)), 0),
        'qtd', COUNT(*)
      )
      FROM vendedor_propostas vp
      LEFT JOIN ebd_clientes ec ON vp.cliente_id = ec.id
      WHERE vp.status IN ('FATURADO', 'PAGO')
        AND vp.created_at >= v_start
        AND vp.created_at < v_end
        AND ec.tipo_cliente = 'Representante'
    )
  ) INTO result;

  RETURN result;
END;
$$;