CREATE OR REPLACE FUNCTION public.get_retencao_dashboard(p_vendedor_id uuid DEFAULT NULL::uuid)
 RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result json; v_mes_inicio timestamptz;
BEGIN
  v_mes_inicio := date_trunc('month', now());
  WITH
  ult_shopify AS (SELECT cliente_id, MAX(created_at) AS dt, SUM(valor_total) AS sum_val, COUNT(*) AS cnt, MAX(created_at) FILTER (WHERE created_at >= v_mes_inicio) AS dt_mes, MAX(created_at) FILTER (WHERE created_at < v_mes_inicio) AS dt_prev FROM ebd_shopify_pedidos WHERE status_pagamento = 'paid' AND cliente_id IS NOT NULL GROUP BY cliente_id),
  ult_mp AS (SELECT cliente_id, MAX(created_at) AS dt, SUM(valor_total) AS sum_val, COUNT(*) AS cnt, MAX(created_at) FILTER (WHERE created_at >= v_mes_inicio) AS dt_mes, MAX(created_at) FILTER (WHERE created_at < v_mes_inicio) AS dt_prev FROM ebd_shopify_pedidos_mercadopago WHERE status = 'PAGO' AND cliente_id IS NOT NULL GROUP BY cliente_id),
  ult_fat AS (SELECT cliente_id, MAX(confirmado_em) AS dt, SUM(valor_total) AS sum_val, COUNT(*) AS cnt, MAX(confirmado_em) FILTER (WHERE confirmado_em >= v_mes_inicio) AS dt_mes, MAX(confirmado_em) FILTER (WHERE confirmado_em < v_mes_inicio) AS dt_prev FROM vendedor_propostas WHERE status IN ('FATURADO', 'PAGO') AND cliente_id IS NOT NULL GROUP BY cliente_id),
  ult_contato AS (SELECT DISTINCT ON (cliente_id) cliente_id, resultado, data_contato FROM ebd_retencao_contatos ORDER BY cliente_id, data_contato DESC),
  comprou_no_mes AS (SELECT cliente_id, MAX(data_contato) AS dt_comprou FROM ebd_retencao_contatos WHERE resultado = 'comprou' AND data_contato >= v_mes_inicio GROUP BY cliente_id),
  base AS (
    SELECT c.id AS cliente_id, c.nome_igreja, c.vendedor_id, c.telefone, c.email_superintendente, v.nome AS vendedor_nome,
      GREATEST(COALESCE(s.dt,'-infinity'::timestamptz), COALESCE(m.dt,'-infinity'::timestamptz), COALESCE(f.dt,'-infinity'::timestamptz)) AS data_ultima_compra,
      CASE WHEN COALESCE(s.dt,'-infinity'::timestamptz) >= GREATEST(COALESCE(m.dt,'-infinity'::timestamptz), COALESCE(f.dt,'-infinity'::timestamptz)) THEN 'E-commerce'
           WHEN COALESCE(m.dt,'-infinity'::timestamptz) >= COALESCE(f.dt,'-infinity'::timestamptz) THEN 'Mercado Pago' ELSE 'Faturado' END AS canal_ultima_compra,
      CASE WHEN (COALESCE(s.cnt,0)+COALESCE(m.cnt,0)+COALESCE(f.cnt,0)) > 0 THEN (COALESCE(s.sum_val,0)+COALESCE(m.sum_val,0)+COALESCE(f.sum_val,0))/(COALESCE(s.cnt,0)+COALESCE(m.cnt,0)+COALESCE(f.cnt,0)) ELSE 0 END AS valor_medio,
      (COALESCE(s.sum_val,0)+COALESCE(m.sum_val,0)+COALESCE(f.sum_val,0)) AS valor_total_compras,
      uc.resultado AS ultimo_resultado, uc.data_contato AS ultimo_contato_data,
      (s.dt_mes IS NOT NULL OR m.dt_mes IS NOT NULL OR f.dt_mes IS NOT NULL) AS comprou_mes,
      GREATEST(COALESCE(s.dt_mes,'-infinity'::timestamptz), COALESCE(m.dt_mes,'-infinity'::timestamptz), COALESCE(f.dt_mes,'-infinity'::timestamptz)) AS dt_compra_mes,
      GREATEST(COALESCE(s.dt_prev,'-infinity'::timestamptz), COALESCE(m.dt_prev,'-infinity'::timestamptz), COALESCE(f.dt_prev,'-infinity'::timestamptz)) AS dt_compra_anterior,
      cm.cliente_id IS NOT NULL AS marcado_comprou_mes, cm.dt_comprou AS dt_marcado_comprou
    FROM ebd_clientes c
    LEFT JOIN vendedores v ON v.id = c.vendedor_id
    LEFT JOIN ult_shopify s ON s.cliente_id = c.id
    LEFT JOIN ult_mp m ON m.cliente_id = c.id
    LEFT JOIN ult_fat f ON f.cliente_id = c.id
    LEFT JOIN ult_contato uc ON uc.cliente_id = c.id
    LEFT JOIN comprou_no_mes cm ON cm.cliente_id = c.id
    WHERE c.status_ativacao_ebd = true AND (p_vendedor_id IS NULL OR c.vendedor_id = p_vendedor_id)
  ),
  com_dias AS (SELECT b.*, EXTRACT(DAY FROM (now() - data_ultima_compra))::int AS dias_sem_compra FROM base b WHERE data_ultima_compra > '-infinity'::timestamptz),
  fechados_mes AS (
    SELECT cliente_id,
      CASE WHEN marcado_comprou_mes AND dt_compra_anterior > '-infinity'::timestamptz THEN EXTRACT(DAY FROM (dt_marcado_comprou - dt_compra_anterior))::int
           WHEN comprou_mes AND dt_compra_anterior > '-infinity'::timestamptz THEN EXTRACT(DAY FROM (dt_compra_mes - dt_compra_anterior))::int
           ELSE NULL END AS dias_para_fechar
    FROM com_dias
    WHERE marcado_comprou_mes OR (comprou_mes AND dt_compra_anterior > '-infinity'::timestamptz AND EXTRACT(DAY FROM (v_mes_inicio - dt_compra_anterior))::int >= 60)
  )
  SELECT json_build_object(
    'faixas', json_build_object(
      'verde',    (SELECT COUNT(*) FROM com_dias WHERE dias_sem_compra <= 30),
      'amarelo',  (SELECT COUNT(*) FROM com_dias WHERE dias_sem_compra > 30 AND dias_sem_compra <= 60),
      'vermelho', (SELECT COUNT(*) FROM com_dias WHERE dias_sem_compra > 60 AND dias_sem_compra <= 90),
      'perdido',  (SELECT COUNT(*) FROM com_dias WHERE dias_sem_compra > 90),
      'fechados', (SELECT COUNT(*) FROM fechados_mes)
    ),
    'kanban_clientes', (
      SELECT COALESCE(json_agg(json_build_object(
        'cliente_id', cd.cliente_id, 'nome_igreja', cd.nome_igreja, 'dias_sem_compra', cd.dias_sem_compra,
        'canal_ultima_compra', cd.canal_ultima_compra, 'vendedor_nome', cd.vendedor_nome, 'vendedor_id', cd.vendedor_id,
        'valor_medio', ROUND(cd.valor_medio::numeric, 2),
        'valor_total_compras', ROUND(cd.valor_total_compras::numeric, 2),
        'telefone', cd.telefone, 'email', cd.email_superintendente,
        'ultimo_resultado', cd.ultimo_resultado, 'ultimo_contato_data', cd.ultimo_contato_data,
        'dias_para_fechar', fm.dias_para_fechar,
        'coluna_kanban', CASE
          WHEN fm.cliente_id IS NOT NULL THEN 'fechados'
          WHEN cd.ultimo_resultado = 'nao_quer_mais' THEN 'perdido'
          WHEN cd.ultimo_resultado = 'retorno_agendado' THEN 'retorno_agendado'
          WHEN cd.ultimo_resultado IS NOT NULL THEN 'contato_feito'
          ELSE 'a_contatar' END
      ) ORDER BY cd.dias_sem_compra DESC), '[]'::json)
      FROM com_dias cd
      LEFT JOIN fechados_mes fm ON fm.cliente_id = cd.cliente_id
      WHERE cd.dias_sem_compra > 60 OR fm.cliente_id IS NOT NULL
    )
  ) INTO result;
  RETURN result;
END;
$function$;