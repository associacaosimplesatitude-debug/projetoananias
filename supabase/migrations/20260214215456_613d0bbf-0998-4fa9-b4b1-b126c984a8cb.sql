
-- Update get_funil_stage_counts to include recompra
CREATE OR REPLACE FUNCTION public.get_funil_stage_counts(p_vendedor_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  v_thirty_days_ago timestamptz;
  v_today date;
  v_in15 date;
BEGIN
  v_thirty_days_ago := now() - interval '30 days';
  v_today := CURRENT_DATE;
  v_in15 := CURRENT_DATE + 15;

  WITH first_buyers AS (
    SELECT fb.customer_email, fb.primeira_compra, p.vendedor_id, p.valor_total
    FROM (
      SELECT customer_email, MIN(created_at) as primeira_compra
      FROM ebd_shopify_pedidos
      WHERE status_pagamento = 'paid'
        AND customer_email IS NOT NULL
        AND customer_email != ''
      GROUP BY customer_email
      HAVING MIN(created_at) >= '2026-01-01T00:00:00Z'
    ) fb
    INNER JOIN ebd_shopify_pedidos p 
      ON p.customer_email = fb.customer_email
      AND p.created_at = fb.primeira_compra
      AND p.status_pagamento = 'paid'
    WHERE (p_vendedor_id IS NULL OR p.vendedor_id = p_vendedor_id)
  ),
  matched_clients AS (
    SELECT DISTINCT ON (fb.customer_email)
      fb.customer_email,
      fb.primeira_compra,
      fb.valor_total,
      c.id as cliente_id,
      c.ultimo_login,
      c.onboarding_concluido,
      c.data_proxima_compra
    FROM first_buyers fb
    INNER JOIN ebd_clientes c 
      ON LOWER(TRIM(c.email_superintendente)) = LOWER(TRIM(fb.customer_email))
    ORDER BY fb.customer_email, c.created_at DESC
  ),
  recompra_data AS (
    SELECT mc.cliente_id, mc.customer_email,
      COALESCE(
        (SELECT SUM(p2.valor_total) FROM ebd_shopify_pedidos p2 
         WHERE LOWER(TRIM(p2.customer_email)) = LOWER(TRIM(mc.customer_email))
           AND p2.status_pagamento = 'paid'
           AND p2.created_at > mc.primeira_compra),
        0
      ) +
      COALESCE(
        (SELECT SUM(mp.valor_total) FROM ebd_shopify_pedidos_mercadopago mp 
         WHERE mp.cliente_id = mc.cliente_id AND mp.status = 'PAGO'),
        0
      ) +
      COALESCE(
        (SELECT SUM(vp.valor_total) FROM vendedor_propostas vp 
         WHERE vp.cliente_id = mc.cliente_id AND vp.status = 'FATURADO'),
        0
      ) as valor_recompra
    FROM matched_clients mc
    WHERE EXISTS (
      SELECT 1 FROM ebd_shopify_pedidos p2 
      WHERE LOWER(TRIM(p2.customer_email)) = LOWER(TRIM(mc.customer_email))
        AND p2.status_pagamento = 'paid'
        AND p2.created_at > mc.primeira_compra
    )
    OR EXISTS (
      SELECT 1 FROM ebd_shopify_pedidos_mercadopago mp 
      WHERE mp.cliente_id = mc.cliente_id AND mp.status = 'PAGO'
    )
    OR EXISTS (
      SELECT 1 FROM vendedor_propostas vp 
      WHERE vp.cliente_id = mc.cliente_id AND vp.status = 'FATURADO'
    )
  )
  SELECT json_build_object(
    'compra_aprovada', (SELECT COUNT(*) FROM first_buyers),
    'compra_aprovada_total', (SELECT COALESCE(SUM(valor_total), 0) FROM first_buyers),
    'aguardando_login', (SELECT COUNT(*) FROM matched_clients WHERE ultimo_login IS NULL),
    'pendente_config', (SELECT COUNT(*) FROM matched_clients WHERE ultimo_login IS NOT NULL AND (onboarding_concluido IS NULL OR onboarding_concluido = false)),
    'ativos', (SELECT COUNT(*) FROM matched_clients WHERE ultimo_login IS NOT NULL AND onboarding_concluido = true AND ultimo_login >= v_thirty_days_ago),
    'zona_renovacao', (SELECT COUNT(*) FROM matched_clients WHERE data_proxima_compra >= v_today AND data_proxima_compra <= v_in15),
    'recompra', (SELECT COUNT(*) FROM recompra_data),
    'recompra_total', (SELECT COALESCE(SUM(valor_recompra), 0) FROM recompra_data)
  ) INTO result;

  RETURN result;
END;
$function$;

-- Update get_funil_stage_list to include recompra case
CREATE OR REPLACE FUNCTION public.get_funil_stage_list(p_vendedor_id uuid DEFAULT NULL::uuid, p_stage text DEFAULT 'compra_aprovada'::text, p_limit integer DEFAULT 500)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  v_thirty_days_ago timestamptz;
  v_today date;
  v_in15 date;
BEGIN
  v_thirty_days_ago := now() - interval '30 days';
  v_today := CURRENT_DATE;
  v_in15 := CURRENT_DATE + 15;

  IF p_stage = 'compra_aprovada' THEN
    SELECT json_agg(row_to_json(t))
    FROM (
      SELECT p.id, p.customer_name as nome_igreja, p.customer_phone as telefone, 
             p.customer_email as email_superintendente, p.valor_total as valor_compra, 
             p.created_at as data_compra,
             NULL::text as senha_temporaria, NULL::timestamptz as ultimo_login
      FROM (
        SELECT customer_email AS email, MIN(created_at) AS primeira_compra
        FROM ebd_shopify_pedidos
        WHERE status_pagamento = 'paid'
          AND customer_email IS NOT NULL AND customer_email != ''
        GROUP BY customer_email
        HAVING MIN(created_at) >= '2026-01-01T00:00:00Z'
      ) fb
      INNER JOIN ebd_shopify_pedidos p ON p.customer_email = fb.email
        AND p.created_at = fb.primeira_compra AND p.status_pagamento = 'paid'
      WHERE (p_vendedor_id IS NULL OR p.vendedor_id = p_vendedor_id)
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) t INTO result;

  ELSIF p_stage = 'recompra' THEN
    WITH first_buyers AS (
      SELECT fb.customer_email, fb.primeira_compra
      FROM (
        SELECT customer_email, MIN(created_at) as primeira_compra
        FROM ebd_shopify_pedidos
        WHERE status_pagamento = 'paid'
          AND customer_email IS NOT NULL AND customer_email != ''
        GROUP BY customer_email
        HAVING MIN(created_at) >= '2026-01-01T00:00:00Z'
      ) fb
      INNER JOIN ebd_shopify_pedidos p ON p.customer_email = fb.customer_email
        AND p.created_at = fb.primeira_compra AND p.status_pagamento = 'paid'
      WHERE (p_vendedor_id IS NULL OR p.vendedor_id = p_vendedor_id)
    ),
    matched AS (
      SELECT DISTINCT ON (fb.customer_email)
        c.id, c.nome_igreja, c.telefone, c.email_superintendente, 
        c.senha_temporaria, c.ultimo_login, fb.customer_email, fb.primeira_compra
      FROM first_buyers fb
      INNER JOIN ebd_clientes c ON LOWER(TRIM(c.email_superintendente)) = LOWER(TRIM(fb.customer_email))
      ORDER BY fb.customer_email, c.created_at DESC
    ),
    recompra_clients AS (
      SELECT m.*,
        COALESCE(
          (SELECT SUM(p2.valor_total) FROM ebd_shopify_pedidos p2 
           WHERE LOWER(TRIM(p2.customer_email)) = LOWER(TRIM(m.customer_email))
             AND p2.status_pagamento = 'paid'
             AND p2.created_at > m.primeira_compra),
          0
        ) +
        COALESCE(
          (SELECT SUM(mp.valor_total) FROM ebd_shopify_pedidos_mercadopago mp 
           WHERE mp.cliente_id = m.id AND mp.status = 'PAGO'),
          0
        ) +
        COALESCE(
          (SELECT SUM(vp.valor_total) FROM vendedor_propostas vp 
           WHERE vp.cliente_id = m.id AND vp.status = 'FATURADO'),
          0
        ) as valor_compra
      FROM matched m
      WHERE EXISTS (
        SELECT 1 FROM ebd_shopify_pedidos p2 
        WHERE LOWER(TRIM(p2.customer_email)) = LOWER(TRIM(m.customer_email))
          AND p2.status_pagamento = 'paid'
          AND p2.created_at > m.primeira_compra
      )
      OR EXISTS (
        SELECT 1 FROM ebd_shopify_pedidos_mercadopago mp 
        WHERE mp.cliente_id = m.id AND mp.status = 'PAGO'
      )
      OR EXISTS (
        SELECT 1 FROM vendedor_propostas vp 
        WHERE vp.cliente_id = m.id AND vp.status = 'FATURADO'
      )
    )
    SELECT json_agg(row_to_json(t))
    FROM (
      SELECT rc.id, rc.nome_igreja, rc.telefone, rc.email_superintendente,
             rc.senha_temporaria, rc.ultimo_login, rc.valor_compra
      FROM recompra_clients rc
      ORDER BY rc.nome_igreja
      LIMIT p_limit
    ) t INTO result;

  ELSE
    WITH first_buyers AS (
      SELECT fb.customer_email
      FROM (
        SELECT customer_email, MIN(created_at) as primeira_compra
        FROM ebd_shopify_pedidos
        WHERE status_pagamento = 'paid'
          AND customer_email IS NOT NULL AND customer_email != ''
        GROUP BY customer_email
        HAVING MIN(created_at) >= '2026-01-01T00:00:00Z'
      ) fb
      INNER JOIN ebd_shopify_pedidos p ON p.customer_email = fb.customer_email
        AND p.created_at = fb.primeira_compra AND p.status_pagamento = 'paid'
      WHERE (p_vendedor_id IS NULL OR p.vendedor_id = p_vendedor_id)
    ),
    matched AS (
      SELECT DISTINCT ON (fb.customer_email)
        c.id, c.nome_igreja, c.telefone, c.email_superintendente, 
        c.senha_temporaria, c.ultimo_login, c.onboarding_concluido, c.data_proxima_compra
      FROM first_buyers fb
      INNER JOIN ebd_clientes c ON LOWER(TRIM(c.email_superintendente)) = LOWER(TRIM(fb.customer_email))
      ORDER BY fb.customer_email, c.created_at DESC
    )
    SELECT json_agg(row_to_json(t))
    FROM (
      SELECT m.id, m.nome_igreja, m.telefone, m.email_superintendente, m.senha_temporaria, m.ultimo_login
      FROM matched m
      WHERE 
        CASE p_stage
          WHEN 'aguardando_login' THEN m.ultimo_login IS NULL
          WHEN 'pendente_config' THEN m.ultimo_login IS NOT NULL AND (m.onboarding_concluido IS NULL OR m.onboarding_concluido = false)
          WHEN 'ativos' THEN m.ultimo_login IS NOT NULL AND m.onboarding_concluido = true AND m.ultimo_login >= v_thirty_days_ago
          WHEN 'zona_renovacao' THEN m.data_proxima_compra >= v_today AND m.data_proxima_compra <= v_in15
          ELSE false
        END
      ORDER BY m.nome_igreja
      LIMIT p_limit
    ) t INTO result;
  END IF;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;
