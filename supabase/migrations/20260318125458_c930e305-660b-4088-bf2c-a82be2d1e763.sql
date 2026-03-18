
CREATE OR REPLACE FUNCTION public.get_retencao_dashboard(p_vendedor_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  v_mes_inicio timestamptz;
BEGIN
  v_mes_inicio := date_trunc('month', now());

  WITH ultima_compra AS (
    SELECT 
      c.id AS cliente_id,
      c.nome_igreja,
      c.vendedor_id,
      c.telefone,
      c.email_superintendente,
      v.nome AS vendedor_nome,
      GREATEST(
        COALESCE((SELECT MAX(p.created_at) FROM ebd_shopify_pedidos p WHERE p.cliente_id = c.id AND p.status_pagamento = 'paid'), '-infinity'::timestamptz),
        COALESCE((SELECT MAX(mp.created_at) FROM ebd_shopify_pedidos_mercadopago mp WHERE mp.cliente_id = c.id AND mp.status = 'PAGO'), '-infinity'::timestamptz),
        COALESCE((SELECT MAX(vp.confirmado_em) FROM vendedor_propostas vp WHERE vp.cliente_id = c.id AND vp.status IN ('FATURADO', 'PAGO')), '-infinity'::timestamptz)
      ) AS data_ultima_compra,
      CASE
        WHEN COALESCE((SELECT MAX(p.created_at) FROM ebd_shopify_pedidos p WHERE p.cliente_id = c.id AND p.status_pagamento = 'paid'), '-infinity'::timestamptz) >= GREATEST(
          COALESCE((SELECT MAX(mp.created_at) FROM ebd_shopify_pedidos_mercadopago mp WHERE mp.cliente_id = c.id AND mp.status = 'PAGO'), '-infinity'::timestamptz),
          COALESCE((SELECT MAX(vp.confirmado_em) FROM vendedor_propostas vp WHERE vp.cliente_id = c.id AND vp.status IN ('FATURADO', 'PAGO')), '-infinity'::timestamptz)
        ) THEN 'E-commerce'
        WHEN COALESCE((SELECT MAX(mp.created_at) FROM ebd_shopify_pedidos_mercadopago mp WHERE mp.cliente_id = c.id AND mp.status = 'PAGO'), '-infinity'::timestamptz) >= COALESCE((SELECT MAX(vp.confirmado_em) FROM vendedor_propostas vp WHERE vp.cliente_id = c.id AND vp.status IN ('FATURADO', 'PAGO')), '-infinity'::timestamptz)
        THEN 'Mercado Pago'
        ELSE 'Faturado'
      END AS canal_ultima_compra,
      (
        SELECT COALESCE(AVG(val), 0)
        FROM (
          SELECT valor_total AS val FROM ebd_shopify_pedidos WHERE cliente_id = c.id AND status_pagamento = 'paid'
          UNION ALL
          SELECT valor_total FROM ebd_shopify_pedidos_mercadopago WHERE cliente_id = c.id AND status = 'PAGO'
          UNION ALL
          SELECT valor_total FROM vendedor_propostas WHERE cliente_id = c.id AND status IN ('FATURADO', 'PAGO')
        ) compras
      ) AS valor_medio
    FROM ebd_clientes c
    LEFT JOIN vendedores v ON c.vendedor_id = v.id
    WHERE c.status_ativacao_ebd = true
      AND (p_vendedor_id IS NULL OR c.vendedor_id = p_vendedor_id)
  ),
  com_dias AS (
    SELECT *,
      EXTRACT(DAY FROM (now() - data_ultima_compra))::int AS dias_sem_compra
    FROM ultima_compra
    WHERE data_ultima_compra > '-infinity'::timestamptz
  ),
  com_contato AS (
    SELECT cd.*,
      rc.resultado AS ultimo_resultado,
      rc.data_contato AS ultimo_contato_data
    FROM com_dias cd
    LEFT JOIN LATERAL (
      SELECT resultado, data_contato
      FROM ebd_retencao_contatos
      WHERE cliente_id = cd.cliente_id
      ORDER BY data_contato DESC
      LIMIT 1
    ) rc ON true
  ),
  fechados_mes AS (
    SELECT DISTINCT cd.cliente_id
    FROM com_dias cd
    WHERE (
      EXISTS (
        SELECT 1 FROM ebd_retencao_contatos rc2
        WHERE rc2.cliente_id = cd.cliente_id
          AND rc2.resultado = 'comprou'
          AND rc2.data_contato >= v_mes_inicio
      )
      OR (
        (
          EXISTS (
            SELECT 1 FROM ebd_shopify_pedidos p
            WHERE p.cliente_id = cd.cliente_id AND p.status_pagamento = 'paid'
              AND p.created_at >= v_mes_inicio
          )
          OR EXISTS (
            SELECT 1 FROM ebd_shopify_pedidos_mercadopago mp
            WHERE mp.cliente_id = cd.cliente_id AND mp.status = 'PAGO'
              AND mp.created_at >= v_mes_inicio
          )
          OR EXISTS (
            SELECT 1 FROM vendedor_propostas vp
            WHERE vp.cliente_id = cd.cliente_id AND vp.status IN ('FATURADO', 'PAGO')
              AND vp.confirmado_em >= v_mes_inicio
          )
        )
        AND EXISTS (
          SELECT 1
          FROM (
            SELECT created_at AS dt FROM ebd_shopify_pedidos WHERE cliente_id = cd.cliente_id AND status_pagamento = 'paid' AND created_at < v_mes_inicio
            UNION ALL
            SELECT created_at FROM ebd_shopify_pedidos_mercadopago WHERE cliente_id = cd.cliente_id AND status = 'PAGO' AND created_at < v_mes_inicio
            UNION ALL
            SELECT confirmado_em FROM vendedor_propostas WHERE cliente_id = cd.cliente_id AND status IN ('FATURADO', 'PAGO') AND confirmado_em < v_mes_inicio
          ) prev
          HAVING EXTRACT(DAY FROM (v_mes_inicio - MAX(prev.dt)))::int >= 60
        )
      )
    )
  )
  SELECT json_build_object(
    'faixas', json_build_object(
      'verde', (SELECT COUNT(*) FROM com_dias WHERE dias_sem_compra <= 30),
      'amarelo', (SELECT COUNT(*) FROM com_dias WHERE dias_sem_compra > 30 AND dias_sem_compra <= 60),
      'vermelho', (SELECT COUNT(*) FROM com_dias WHERE dias_sem_compra > 60 AND dias_sem_compra <= 90),
      'perdido', (SELECT COUNT(*) FROM com_dias WHERE dias_sem_compra > 90),
      'fechados', (SELECT COUNT(*) FROM fechados_mes)
    ),
    'kanban_clientes', (
      SELECT COALESCE(json_agg(json_build_object(
        'cliente_id', cc.cliente_id,
        'nome_igreja', cc.nome_igreja,
        'dias_sem_compra', cc.dias_sem_compra,
        'canal_ultima_compra', cc.canal_ultima_compra,
        'vendedor_nome', cc.vendedor_nome,
        'vendedor_id', cc.vendedor_id,
        'valor_medio', ROUND(cc.valor_medio::numeric, 2),
        'telefone', cc.telefone,
        'email', cc.email_superintendente,
        'ultimo_resultado', cc.ultimo_resultado,
        'ultimo_contato_data', cc.ultimo_contato_data,
        'coluna_kanban', CASE
          WHEN cc.ultimo_resultado = 'nao_quer_mais' THEN 'perdido'
          WHEN cc.ultimo_resultado = 'retorno_agendado' THEN 'retorno_agendado'
          WHEN cc.ultimo_resultado IS NOT NULL THEN 'contato_feito'
          ELSE 'a_contatar'
        END
      ) ORDER BY cc.dias_sem_compra DESC), '[]'::json)
      FROM com_contato cc
      WHERE cc.dias_sem_compra > 60
    )
  ) INTO result;

  RETURN result;
END;
$function$;
