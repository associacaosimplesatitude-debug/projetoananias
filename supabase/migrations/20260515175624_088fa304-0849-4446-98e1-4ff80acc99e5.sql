CREATE OR REPLACE FUNCTION public.get_resumo_diario(data_ref date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_data_ontem date := data_ref - INTERVAL '1 day';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH
  ecommerce AS (
    SELECT id, vendedor_id, valor_total
    FROM ebd_shopify_pedidos
    WHERE status_pagamento = 'paid'
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = data_ref
  ),
  faturados_propostas AS (
    SELECT id, vendedor_id, valor_total, bling_order_id,
      CASE WHEN jsonb_typeof(itens) = 'array' THEN itens ELSE '[]'::jsonb END AS itens_arr
    FROM vendedor_propostas
    WHERE status IN ('FATURADO','APROVADA_FATURAMENTO','PAGO')
      AND (COALESCE(confirmado_em, updated_at) AT TIME ZONE 'America/Sao_Paulo')::date = data_ref
  ),
  faturados_shopify AS (
    SELECT s.id, s.vendedor_id, s.valor_total, s.bling_order_id
    FROM ebd_shopify_pedidos s
    WHERE s.status_pagamento = 'Faturado'
      AND (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date = data_ref
      AND NOT EXISTS (
        SELECT 1 FROM faturados_propostas p
        WHERE p.bling_order_id IS NOT NULL
          AND s.bling_order_id IS NOT NULL
          AND p.bling_order_id = s.bling_order_id
      )
  ),
  mp_link AS (
    SELECT id, vendedor_id, valor_total,
      CASE WHEN jsonb_typeof(items) = 'array' THEN items ELSE '[]'::jsonb END AS items_arr
    FROM ebd_shopify_pedidos_mercadopago
    WHERE (status = 'PAGO' OR payment_status IN ('approved','PAGO','paid'))
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = data_ref
  ),
  balcao AS (
    SELECT id, vendedor_id, valor_total,
      CASE WHEN jsonb_typeof(itens) = 'array' THEN itens ELSE '[]'::jsonb END AS itens_arr
    FROM vendas_balcao
    WHERE status = 'finalizada'
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = data_ref
  ),
  mkt_shopee AS (
    SELECT id, valor_total
    FROM bling_marketplace_pedidos
    WHERE marketplace = 'SHOPEE'
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = data_ref
  ),
  mkt_ml AS (
    SELECT id, valor_total
    FROM bling_marketplace_pedidos
    WHERE marketplace = 'MERCADO_LIVRE'
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = data_ref
  ),

  totais_hoje AS (
    SELECT
      COALESCE((SELECT SUM(valor_total) FROM ecommerce),0) +
      COALESCE((SELECT SUM(valor_total) FROM faturados_shopify),0) +
      COALESCE((SELECT SUM(valor_total) FROM faturados_propostas),0) +
      COALESCE((SELECT SUM(valor_total) FROM mp_link),0) +
      COALESCE((SELECT SUM(valor_total) FROM balcao),0) +
      COALESCE((SELECT SUM(valor_total) FROM mkt_shopee),0) +
      COALESCE((SELECT SUM(valor_total) FROM mkt_ml),0) AS faturamento,
      (SELECT COUNT(*) FROM ecommerce) +
      (SELECT COUNT(*) FROM faturados_shopify) +
      (SELECT COUNT(*) FROM faturados_propostas) +
      (SELECT COUNT(*) FROM mp_link) +
      (SELECT COUNT(*) FROM balcao) +
      (SELECT COUNT(*) FROM mkt_shopee) +
      (SELECT COUNT(*) FROM mkt_ml) AS pedidos
  ),

  -- Para "ontem" usamos a mesma lógica de dedupe
  fp_ontem AS (
    SELECT id, valor_total, bling_order_id FROM vendedor_propostas
    WHERE status IN ('FATURADO','APROVADA_FATURAMENTO','PAGO')
      AND (COALESCE(confirmado_em, updated_at) AT TIME ZONE 'America/Sao_Paulo')::date = v_data_ontem
  ),
  fs_ontem AS (
    SELECT s.id, s.valor_total
    FROM ebd_shopify_pedidos s
    WHERE s.status_pagamento = 'Faturado'
      AND (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_data_ontem
      AND NOT EXISTS (
        SELECT 1 FROM fp_ontem p
        WHERE p.bling_order_id IS NOT NULL AND s.bling_order_id IS NOT NULL
          AND p.bling_order_id = s.bling_order_id
      )
  ),
  totais_ontem AS (
    SELECT
      COALESCE((SELECT SUM(valor_total) FROM ebd_shopify_pedidos
        WHERE status_pagamento = 'paid'
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_data_ontem),0) +
      COALESCE((SELECT SUM(valor_total) FROM fs_ontem),0) +
      COALESCE((SELECT SUM(valor_total) FROM fp_ontem),0) +
      COALESCE((SELECT SUM(valor_total) FROM ebd_shopify_pedidos_mercadopago
        WHERE (status = 'PAGO' OR payment_status IN ('approved','PAGO','paid'))
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_data_ontem),0) +
      COALESCE((SELECT SUM(valor_total) FROM vendas_balcao
        WHERE status = 'finalizada'
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_data_ontem),0) +
      COALESCE((SELECT SUM(valor_total) FROM bling_marketplace_pedidos
        WHERE marketplace IN ('SHOPEE','MERCADO_LIVRE')
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_data_ontem),0) AS faturamento,
      (
        (SELECT COUNT(*) FROM ebd_shopify_pedidos
          WHERE status_pagamento = 'paid'
            AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_data_ontem) +
        (SELECT COUNT(*) FROM fs_ontem) +
        (SELECT COUNT(*) FROM fp_ontem) +
        (SELECT COUNT(*) FROM ebd_shopify_pedidos_mercadopago
          WHERE (status = 'PAGO' OR payment_status IN ('approved','PAGO','paid'))
            AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_data_ontem) +
        (SELECT COUNT(*) FROM vendas_balcao
          WHERE status = 'finalizada'
            AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_data_ontem) +
        (SELECT COUNT(*) FROM bling_marketplace_pedidos
          WHERE marketplace IN ('SHOPEE','MERCADO_LIVRE')
            AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_data_ontem)
      ) AS pedidos
  ),

  itens_norm AS (
    SELECT (it->>'titulo')::text AS titulo,
           COALESCE(NULLIF(it->>'quantidade','')::numeric, 1) AS quantidade,
           COALESCE(NULLIF(it->>'valor_total','')::numeric,
                    NULLIF(it->>'preco_total','')::numeric,
                    (COALESCE(NULLIF(it->>'preco','')::numeric,0) * COALESCE(NULLIF(it->>'quantidade','')::numeric,1)),
                    0) AS valor
    FROM faturados_propostas, jsonb_array_elements(itens_arr) AS it
    UNION ALL
    SELECT (it->>'titulo')::text AS titulo,
           COALESCE(NULLIF(it->>'quantidade','')::numeric, 1) AS quantidade,
           COALESCE(NULLIF(it->>'valor_total','')::numeric,
                    NULLIF(it->>'preco_total','')::numeric,
                    (COALESCE(NULLIF(it->>'preco','')::numeric,0) * COALESCE(NULLIF(it->>'quantidade','')::numeric,1)),
                    0) AS valor
    FROM mp_link, jsonb_array_elements(items_arr) AS it
    UNION ALL
    SELECT (it->>'titulo')::text AS titulo,
           COALESCE(NULLIF(it->>'quantidade','')::numeric, 1) AS quantidade,
           COALESCE(NULLIF(it->>'valor_total','')::numeric,
                    NULLIF(it->>'preco_total','')::numeric,
                    (COALESCE(NULLIF(it->>'preco','')::numeric,0) * COALESCE(NULLIF(it->>'quantidade','')::numeric,1)),
                    0) AS valor
    FROM balcao, jsonb_array_elements(itens_arr) AS it
  ),
  itens_classif AS (
    SELECT
      titulo, quantidade, valor,
      CASE
        WHEN titulo ILIKE '%revista%' THEN 'revistas'
        WHEN titulo ILIKE '%livro digital%' OR titulo ILIKE '%e-book%' OR titulo ILIKE '%ebook%' OR titulo ILIKE '%digital%' THEN 'digitais'
        WHEN titulo ILIKE '%livro%' THEN 'livros_fisicos'
        ELSE 'outros'
      END AS categoria
    FROM itens_norm
  ),
  mix AS (
    SELECT categoria,
           SUM(quantidade)::numeric AS quantidade,
           SUM(valor)::numeric AS valor
    FROM itens_classif
    GROUP BY categoria
  ),
  destaque AS (
    SELECT titulo, SUM(quantidade)::numeric AS quantidade
    FROM itens_norm
    WHERE titulo IS NOT NULL AND titulo <> ''
    GROUP BY titulo
    ORDER BY SUM(quantidade) DESC NULLS LAST
    LIMIT 1
  ),

  vend_agg AS (
    SELECT vendedor_id, SUM(valor_total)::numeric AS valor, COUNT(*)::int AS pedidos
    FROM (
      SELECT vendedor_id, valor_total FROM ecommerce WHERE vendedor_id IS NOT NULL
      UNION ALL
      SELECT vendedor_id, valor_total FROM faturados_shopify WHERE vendedor_id IS NOT NULL
      UNION ALL
      SELECT vendedor_id, valor_total FROM faturados_propostas WHERE vendedor_id IS NOT NULL
      UNION ALL
      SELECT vendedor_id, valor_total FROM mp_link WHERE vendedor_id IS NOT NULL
      UNION ALL
      SELECT vendedor_id, valor_total FROM balcao WHERE vendedor_id IS NOT NULL
    ) t
    GROUP BY vendedor_id
  ),
  vend_top5 AS (
    SELECT v.vendedor_id, vv.nome, vv.foto_url, v.valor, v.pedidos
    FROM vend_agg v
    LEFT JOIN vendedores vv ON vv.id = v.vendedor_id
    ORDER BY v.valor DESC NULLS LAST
    LIMIT 5
  ),

  multi_lic AS (
    SELECT COUNT(*)::int AS pacotes, COALESCE(SUM(valor_total),0)::numeric AS valor
    FROM faturados_propostas
    WHERE jsonb_typeof(itens_arr) = 'array'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(itens_arr) it
        WHERE (it->>'titulo') ILIKE '%multi%licen%'
      )
  )

  SELECT jsonb_build_object(
    'totais', jsonb_build_object(
      'faturamento', ROUND((SELECT faturamento FROM totais_hoje)::numeric, 2),
      'pedidos', (SELECT pedidos FROM totais_hoje),
      'ticket_medio', CASE WHEN (SELECT pedidos FROM totais_hoje) > 0
                           THEN ROUND(((SELECT faturamento FROM totais_hoje) / (SELECT pedidos FROM totais_hoje))::numeric, 2)
                           ELSE 0 END,
      'produtos_vendidos', COALESCE((SELECT SUM(quantidade) FROM itens_norm), 0),
      'faturamento_ontem', ROUND((SELECT faturamento FROM totais_ontem)::numeric, 2),
      'pedidos_ontem', (SELECT pedidos FROM totais_ontem),
      'variacao_percentual', CASE WHEN (SELECT faturamento FROM totais_ontem) > 0
                                  THEN ROUND((((SELECT faturamento FROM totais_hoje) - (SELECT faturamento FROM totais_ontem)) / (SELECT faturamento FROM totais_ontem) * 100)::numeric, 2)
                                  ELSE 0 END
    ),
    'canais', jsonb_build_array(
      jsonb_build_object('canal','Faturados',
        'valor', ROUND((COALESCE((SELECT SUM(valor_total) FROM faturados_shopify),0) + COALESCE((SELECT SUM(valor_total) FROM faturados_propostas),0))::numeric, 2),
        'pedidos', (SELECT COUNT(*) FROM faturados_shopify) + (SELECT COUNT(*) FROM faturados_propostas)),
      jsonb_build_object('canal','Mercado Pago',
        'valor', ROUND(COALESCE((SELECT SUM(valor_total) FROM mp_link),0)::numeric, 2),
        'pedidos', (SELECT COUNT(*) FROM mp_link)),
      jsonb_build_object('canal','E-commerce',
        'valor', ROUND(COALESCE((SELECT SUM(valor_total) FROM ecommerce),0)::numeric, 2),
        'pedidos', (SELECT COUNT(*) FROM ecommerce)),
      jsonb_build_object('canal','Balcão Penha',
        'valor', ROUND(COALESCE((SELECT SUM(valor_total) FROM balcao),0)::numeric, 2),
        'pedidos', (SELECT COUNT(*) FROM balcao)),
      jsonb_build_object('canal','Shopee',
        'valor', ROUND(COALESCE((SELECT SUM(valor_total) FROM mkt_shopee),0)::numeric, 2),
        'pedidos', (SELECT COUNT(*) FROM mkt_shopee)),
      jsonb_build_object('canal','Mercado Livre',
        'valor', ROUND(COALESCE((SELECT SUM(valor_total) FROM mkt_ml),0)::numeric, 2),
        'pedidos', (SELECT COUNT(*) FROM mkt_ml))
    ),
    'vendedores_top5', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'vendedor_id', vendedor_id,
        'nome', COALESCE(nome,'(sem nome)'),
        'foto_url', foto_url,
        'pedidos', pedidos,
        'valor', ROUND(valor::numeric, 2)
      )) FROM vend_top5
    ), '[]'::jsonb),
    'mix_produtos', jsonb_build_object(
      'revistas', jsonb_build_object(
        'quantidade', COALESCE((SELECT quantidade FROM mix WHERE categoria='revistas'),0),
        'valor', ROUND(COALESCE((SELECT valor FROM mix WHERE categoria='revistas'),0)::numeric, 2)),
      'livros_fisicos', jsonb_build_object(
        'quantidade', COALESCE((SELECT quantidade FROM mix WHERE categoria='livros_fisicos'),0),
        'valor', ROUND(COALESCE((SELECT valor FROM mix WHERE categoria='livros_fisicos'),0)::numeric, 2)),
      'digitais', jsonb_build_object(
        'quantidade', COALESCE((SELECT quantidade FROM mix WHERE categoria='digitais'),0),
        'valor', ROUND(COALESCE((SELECT valor FROM mix WHERE categoria='digitais'),0)::numeric, 2)),
      'outros', jsonb_build_object(
        'quantidade', COALESCE((SELECT quantidade FROM mix WHERE categoria='outros'),0),
        'valor', ROUND(COALESCE((SELECT valor FROM mix WHERE categoria='outros'),0)::numeric, 2))
    ),
    'multi_licenca', jsonb_build_object(
      'pacotes', COALESCE((SELECT pacotes FROM multi_lic),0),
      'valor', ROUND(COALESCE((SELECT valor FROM multi_lic),0)::numeric, 2)),
    'destaque_produto', (SELECT jsonb_build_object('titulo', titulo, 'quantidade', quantidade) FROM destaque)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;