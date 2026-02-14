
-- 1. Atualizar get_primeira_compra_funil_total para usar 2026-01-01
CREATE OR REPLACE FUNCTION public.get_primeira_compra_funil_total(p_vendedor_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'count', COUNT(*)::integer,
    'total', COALESCE(SUM(p.valor_total), 0)
  )
  FROM (
    SELECT customer_email, MIN(created_at) as primeira_compra
    FROM ebd_shopify_pedidos
    WHERE status_pagamento = 'paid'
      AND customer_email IS NOT NULL
      AND customer_email != ''
    GROUP BY customer_email
    HAVING MIN(created_at) >= '2026-01-01T00:00:00Z'
  ) first_buyers
  INNER JOIN ebd_shopify_pedidos p 
    ON p.customer_email = first_buyers.customer_email
    AND p.created_at = first_buyers.primeira_compra
    AND p.status_pagamento = 'paid'
  WHERE (p_vendedor_id IS NULL OR p.vendedor_id = p_vendedor_id);
$function$;

-- 2. Atualizar get_primeira_compra_funil_list para usar 2026-01-01
CREATE OR REPLACE FUNCTION public.get_primeira_compra_funil_list(p_vendedor_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, customer_name text, customer_phone text, customer_email text, valor_total numeric, created_at timestamp with time zone, vendedor_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.id,
    p.customer_name,
    p.customer_phone,
    p.customer_email,
    p.valor_total,
    p.created_at,
    p.vendedor_id
  FROM (
    SELECT customer_email AS email, MIN(created_at) AS primeira_compra
    FROM ebd_shopify_pedidos
    WHERE status_pagamento = 'paid'
      AND customer_email IS NOT NULL
      AND customer_email != ''
    GROUP BY customer_email
    HAVING MIN(created_at) >= '2026-01-01T00:00:00Z'
  ) first_buyers
  INNER JOIN ebd_shopify_pedidos p 
    ON p.customer_email = first_buyers.email
    AND p.created_at = first_buyers.primeira_compra
    AND p.status_pagamento = 'paid'
  WHERE (p_vendedor_id IS NULL OR p.vendedor_id = p_vendedor_id)
  ORDER BY p.created_at DESC
  LIMIT p_limit;
$function$;

-- 3. Atualizar get_primeira_compra_funil_count para usar 2026-01-01
CREATE OR REPLACE FUNCTION public.get_primeira_compra_funil_count(p_vendedor_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::integer
  FROM (
    SELECT customer_email, MIN(created_at) as primeira_compra
    FROM ebd_shopify_pedidos
    WHERE status_pagamento = 'paid'
      AND customer_email IS NOT NULL
      AND customer_email != ''
    GROUP BY customer_email
    HAVING MIN(created_at) >= '2026-01-01T00:00:00Z'
  ) first_buyers
  INNER JOIN LATERAL (
    SELECT vendedor_id
    FROM ebd_shopify_pedidos p2
    WHERE p2.customer_email = first_buyers.customer_email
      AND p2.created_at = first_buyers.primeira_compra
      AND p2.status_pagamento = 'paid'
    LIMIT 1
  ) pedido ON true
  WHERE (p_vendedor_id IS NULL OR pedido.vendedor_id = p_vendedor_id);
$function$;

-- 4. Nova RPC unificada: get_funil_stage_counts
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
    SELECT fb.customer_email, p.vendedor_id, p.valor_total
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
      fb.valor_total,
      c.id as cliente_id,
      c.ultimo_login,
      c.onboarding_concluido,
      c.data_proxima_compra
    FROM first_buyers fb
    INNER JOIN ebd_clientes c 
      ON LOWER(TRIM(c.email_superintendente)) = LOWER(TRIM(fb.customer_email))
    ORDER BY fb.customer_email, c.created_at DESC
  )
  SELECT json_build_object(
    'compra_aprovada', (SELECT COUNT(*) FROM first_buyers),
    'compra_aprovada_total', (SELECT COALESCE(SUM(valor_total), 0) FROM first_buyers),
    'aguardando_login', (SELECT COUNT(*) FROM matched_clients WHERE ultimo_login IS NULL),
    'pendente_config', (SELECT COUNT(*) FROM matched_clients WHERE ultimo_login IS NOT NULL AND (onboarding_concluido IS NULL OR onboarding_concluido = false)),
    'ativos', (SELECT COUNT(*) FROM matched_clients WHERE ultimo_login IS NOT NULL AND onboarding_concluido = true AND ultimo_login >= v_thirty_days_ago),
    'zona_renovacao', (SELECT COUNT(*) FROM matched_clients WHERE data_proxima_compra >= v_today AND data_proxima_compra <= v_in15)
  ) INTO result;

  RETURN result;
END;
$function$;

-- 5. Nova RPC para lista expandida com filtro progressivo
CREATE OR REPLACE FUNCTION public.get_funil_stage_list(p_vendedor_id uuid DEFAULT NULL::uuid, p_stage text DEFAULT 'compra_aprovada', p_limit integer DEFAULT 500)
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
    -- Retorna direto da lista de primeira compra
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
