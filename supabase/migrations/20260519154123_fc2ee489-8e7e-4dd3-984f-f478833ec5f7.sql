CREATE OR REPLACE FUNCTION public.get_resumo_diario_canal_pedidos(
  data_ref date,
  canal text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean := false;
  v_result jsonb;
BEGIN
  v_is_admin := COALESCE(public.has_role(auth.uid(), 'admin'), false);
  IF NOT v_is_admin AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF canal = 'faturados' THEN
    WITH fp AS (
      SELECT id::text AS id, cliente_nome, vendedor_nome, valor_total,
        COALESCE(confirmado_em, updated_at) AS quando,
        bling_order_number::text AS numero, bling_order_id
      FROM public.vendedor_propostas
      WHERE status IN ('FATURADO','APROVADA_FATURAMENTO','PAGO')
        AND (COALESCE(confirmado_em, updated_at) AT TIME ZONE 'America/Sao_Paulo')::date = data_ref
    ),
    fs AS (
      SELECT s.id::text AS id,
        COALESCE(s.customer_name, 'Cliente') AS cliente_nome,
        NULL::text AS vendedor_nome,
        s.valor_total,
        s.created_at AS quando,
        s.order_number::text AS numero,
        s.bling_order_id
      FROM public.ebd_shopify_pedidos s
      WHERE s.status_pagamento = 'Faturado'
        AND (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date = data_ref
        AND NOT EXISTS (
          SELECT 1
          FROM fp
          WHERE fp.bling_order_id IS NOT NULL
            AND s.bling_order_id IS NOT NULL
            AND fp.bling_order_id = s.bling_order_id
        )
    ),
    todos AS (
      SELECT id, 'Faturado'::text AS origem, cliente_nome, vendedor_nome, valor_total, quando, numero FROM fp
      UNION ALL
      SELECT id, 'Faturado Shopify'::text AS origem, cliente_nome, vendedor_nome, valor_total, quando, numero FROM fs
    )
    SELECT jsonb_agg(jsonb_build_object(
      'id', id,
      'origem', origem,
      'cliente', cliente_nome,
      'vendedor', vendedor_nome,
      'valor', valor_total,
      'quando', quando,
      'numero', numero
    ) ORDER BY valor_total DESC)
      INTO v_result
    FROM todos;

  ELSIF canal = 'mercado_pago' THEN
    SELECT jsonb_agg(jsonb_build_object(
      'id', id::text,
      'origem', 'MP Link',
      'cliente', cliente_nome,
      'vendedor', NULL,
      'valor', valor_total,
      'quando', created_at,
      'numero', NULL
    ) ORDER BY valor_total DESC)
      INTO v_result
    FROM public.ebd_shopify_pedidos_mercadopago
    WHERE (status = 'PAGO' OR payment_status IN ('approved','PAGO','paid'))
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = data_ref;

  ELSIF canal = 'ecommerce' THEN
    WITH ec AS (
      SELECT id::text AS id,
        'Shopify'::text AS origem,
        COALESCE(customer_name, 'Cliente') AS cliente_nome,
        NULL::text AS vendedor_nome,
        valor_total,
        created_at AS quando,
        order_number::text AS numero
      FROM public.ebd_shopify_pedidos
      WHERE status_pagamento = 'paid'
        AND (order_number IS NULL OR order_number::text NOT ILIKE 'BLING-%')
        AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = data_ref

      UNION ALL

      SELECT id::text,
        'Loja CG'::text AS origem,
        COALESCE(customer_name, endereco_nome, 'Cliente loja') AS cliente_nome,
        NULL::text AS vendedor_nome,
        valor_total,
        created_at AS quando,
        loja_order_number::text AS numero
      FROM public.ebd_loja_pedidos_cg
      WHERE status_pagamento = 'paid'
        AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = data_ref
    )
    SELECT jsonb_agg(jsonb_build_object(
      'id', id,
      'origem', origem,
      'cliente', cliente_nome,
      'vendedor', vendedor_nome,
      'valor', valor_total,
      'quando', quando,
      'numero', numero
    ) ORDER BY valor_total DESC)
      INTO v_result
    FROM ec;

  ELSIF canal = 'balcao_penha' THEN
    SELECT jsonb_agg(jsonb_build_object(
      'id', id::text,
      'origem', 'Balcão',
      'cliente', cliente_nome,
      'vendedor', NULL,
      'valor', valor_total,
      'quando', created_at,
      'numero', NULL
    ) ORDER BY valor_total DESC)
      INTO v_result
    FROM public.vendas_balcao
    WHERE status = 'finalizada'
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = data_ref;

  ELSIF canal = 'shopee' THEN
    SELECT jsonb_agg(jsonb_build_object(
      'id', id::text,
      'origem', 'Shopee',
      'cliente', customer_name,
      'vendedor', NULL,
      'valor', valor_total,
      'quando', created_at,
      'numero', order_number
    ) ORDER BY valor_total DESC)
      INTO v_result
    FROM public.bling_marketplace_pedidos
    WHERE marketplace = 'SHOPEE'
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = data_ref;

  ELSIF canal = 'mercado_livre' THEN
    SELECT jsonb_agg(jsonb_build_object(
      'id', id::text,
      'origem', 'Mercado Livre',
      'cliente', customer_name,
      'vendedor', NULL,
      'valor', valor_total,
      'quando', created_at,
      'numero', order_number
    ) ORDER BY valor_total DESC)
      INTO v_result
    FROM public.bling_marketplace_pedidos
    WHERE marketplace = 'MERCADO_LIVRE'
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = data_ref;
  ELSE
    RAISE EXCEPTION 'canal inválido: %', canal;
  END IF;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;