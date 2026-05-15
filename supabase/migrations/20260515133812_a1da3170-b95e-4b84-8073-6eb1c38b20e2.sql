
-- =====================================================
-- 1) Tabela resumo_diario_destinatarios
-- =====================================================
CREATE TABLE IF NOT EXISTS public.resumo_diario_destinatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text NOT NULL UNIQUE,
  cargo text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resumo_diario_destinatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage resumo_diario_destinatarios"
ON public.resumo_diario_destinatarios
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_resumo_diario_destinatarios_updated_at
BEFORE UPDATE ON public.resumo_diario_destinatarios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 2) Função get_resumo_diario(date)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_resumo_diario(data_ref date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_data_ontem date := data_ref - INTERVAL '1 day';
BEGIN
  -- Auth: somente admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH
  -- ============ FONTES DE PEDIDOS PAGOS NO DIA ============
  shopify_paid AS (
    SELECT id, vendedor_id, valor_total
    FROM ebd_shopify_pedidos
    WHERE status_pagamento = 'paid'
      AND (order_date AT TIME ZONE 'America/Sao_Paulo')::date = data_ref
  ),
  shopify_faturado AS (
    SELECT id, vendedor_id, valor_total
    FROM ebd_shopify_pedidos
    WHERE status_pagamento = 'Faturado'
      AND (order_date AT TIME ZONE 'America/Sao_Paulo')::date = data_ref
  ),
  mp_link AS (
    SELECT id, vendedor_id, valor_total, items
    FROM ebd_shopify_pedidos_mercadopago
    WHERE status = 'PAGO'
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = data_ref
  ),
  fat_direto AS (
    SELECT id, vendedor_id, valor_total, itens
    FROM vendedor_propostas
    WHERE status IN ('FATURADO','PAGO')
      AND (confirmado_em AT TIME ZONE 'America/Sao_Paulo')::date = data_ref
  ),
  nova_loja AS (
    SELECT id, vendedor_id, valor_total
    FROM ebd_loja_pedidos_cg
    WHERE status_pagamento = 'paid'
      AND (paid_at AT TIME ZONE 'America/Sao_Paulo')::date = data_ref
  ),
  mkt AS (
    SELECT id, marketplace, valor_total
    FROM bling_marketplace_pedidos
    WHERE (order_date AT TIME ZONE 'America/Sao_Paulo')::date = data_ref
  ),

  -- ============ TOTAIS HOJE ============
  totais_hoje AS (
    SELECT
      COALESCE((SELECT SUM(valor_total) FROM shopify_paid),0) +
      COALESCE((SELECT SUM(valor_total) FROM shopify_faturado),0) +
      COALESCE((SELECT SUM(valor_total) FROM mp_link),0) +
      COALESCE((SELECT SUM(valor_total) FROM fat_direto),0) +
      COALESCE((SELECT SUM(valor_total) FROM nova_loja),0) +
      COALESCE((SELECT SUM(valor_total) FROM mkt),0) AS faturamento,
      (SELECT COUNT(*) FROM shopify_paid) +
      (SELECT COUNT(*) FROM shopify_faturado) +
      (SELECT COUNT(*) FROM mp_link) +
      (SELECT COUNT(*) FROM fat_direto) +
      (SELECT COUNT(*) FROM nova_loja) +
      (SELECT COUNT(*) FROM mkt) AS pedidos
  ),

  -- ============ TOTAIS ONTEM ============
  totais_ontem AS (
    SELECT
      COALESCE((
        SELECT SUM(valor_total) FROM ebd_shopify_pedidos
        WHERE status_pagamento IN ('paid','Faturado')
          AND (order_date AT TIME ZONE 'America/Sao_Paulo')::date = v_data_ontem
      ),0) +
      COALESCE((
        SELECT SUM(valor_total) FROM ebd_shopify_pedidos_mercadopago
        WHERE status = 'PAGO'
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_data_ontem
      ),0) +
      COALESCE((
        SELECT SUM(valor_total) FROM vendedor_propostas
        WHERE status IN ('FATURADO','PAGO')
          AND (confirmado_em AT TIME ZONE 'America/Sao_Paulo')::date = v_data_ontem
      ),0) +
      COALESCE((
        SELECT SUM(valor_total) FROM ebd_loja_pedidos_cg
        WHERE status_pagamento = 'paid'
          AND (paid_at AT TIME ZONE 'America/Sao_Paulo')::date = v_data_ontem
      ),0) +
      COALESCE((
        SELECT SUM(valor_total) FROM bling_marketplace_pedidos
        WHERE (order_date AT TIME ZONE 'America/Sao_Paulo')::date = v_data_ontem
      ),0) AS faturamento
  ),

  -- ============ ITENS NORMALIZADOS ============
  itens_norm AS (
    -- shopify (paid + faturado) -> tabela de itens
    SELECT i.product_title AS title, i.sku, i.quantity::numeric AS quantity, i.price::numeric AS price
    FROM ebd_shopify_pedidos_itens i
    WHERE i.pedido_id IN (SELECT id FROM shopify_paid UNION ALL SELECT id FROM shopify_faturado)
    UNION ALL
    -- mercadopago link
    SELECT
      (it->>'title') AS title,
      (it->>'sku')   AS sku,
      COALESCE((it->>'quantity')::numeric,0) AS quantity,
      COALESCE((it->>'price')::numeric,0)    AS price
    FROM mp_link, LATERAL jsonb_array_elements(COALESCE(items,'[]'::jsonb)) it
    UNION ALL
    -- faturamento direto
    SELECT
      (it->>'title') AS title,
      (it->>'sku')   AS sku,
      COALESCE((it->>'quantity')::numeric,0) AS quantity,
      COALESCE((it->>'price')::numeric,0)    AS price
    FROM fat_direto, LATERAL jsonb_array_elements(COALESCE(itens,'[]'::jsonb)) it
  ),

  itens_classif AS (
    SELECT
      title, sku, quantity, price,
      CASE
        WHEN sku ILIKE 'DIG-%' THEN 'digitais'
        WHEN title ILIKE '%revista%' OR title ILIKE '%lição%' OR title ILIKE '%licao%'
             OR title ILIKE '%ebd%' OR title ILIKE '%lições bíblicas%' THEN 'revistas'
        WHEN title ILIKE '%livro%' OR title ILIKE '%devocional%'
             OR title ILIKE '%bíblia%' OR title ILIKE '%biblia%' THEN 'livros_fisicos'
        ELSE 'outros'
      END AS categoria
    FROM itens_norm
  ),

  mix AS (
    SELECT
      categoria,
      SUM(quantity) AS qtd,
      SUM(quantity * price) AS valor
    FROM itens_classif
    GROUP BY categoria
  ),

  destaque AS (
    SELECT title, SUM(quantity) AS qtd
    FROM itens_classif
    WHERE title IS NOT NULL
    GROUP BY title
    ORDER BY qtd DESC
    LIMIT 1
  ),

  -- ============ VENDEDORES ============
  vend_agg AS (
    SELECT vendedor_id, SUM(valor_total) AS valor, COUNT(*) AS pedidos
    FROM (
      SELECT vendedor_id, valor_total FROM shopify_paid WHERE vendedor_id IS NOT NULL
      UNION ALL
      SELECT vendedor_id, valor_total FROM shopify_faturado WHERE vendedor_id IS NOT NULL
      UNION ALL
      SELECT vendedor_id, valor_total FROM mp_link WHERE vendedor_id IS NOT NULL
      UNION ALL
      SELECT vendedor_id, valor_total FROM fat_direto WHERE vendedor_id IS NOT NULL
      UNION ALL
      SELECT vendedor_id, valor_total FROM nova_loja WHERE vendedor_id IS NOT NULL
    ) x
    GROUP BY vendedor_id
    ORDER BY valor DESC
    LIMIT 5
  ),

  vend_top5 AS (
    SELECT v.id AS vendedor_id, v.nome, v.foto_url,
           ROUND(va.valor::numeric, 2) AS valor, va.pedidos
    FROM vend_agg va
    JOIN vendedores v ON v.id = va.vendedor_id
    ORDER BY va.valor DESC
  ),

  -- ============ MULTI-LICENÇA ============
  multi_lic AS (
    SELECT COUNT(DISTINCT nl.id) AS pacotes,
           COALESCE(SUM(nl.valor_total),0) AS valor
    FROM nova_loja nl
    WHERE nl.id IN (
      SELECT loja_order_id FROM revista_licencas
      WHERE origem = 'nova_loja_cg' AND loja_order_id IS NOT NULL
    )
  )

  -- ============ MONTAGEM FINAL ============
  SELECT jsonb_build_object(
    'data_ref', data_ref,
    'totais', jsonb_build_object(
      'faturamento', ROUND((SELECT faturamento FROM totais_hoje)::numeric, 2),
      'pedidos', (SELECT pedidos FROM totais_hoje),
      'ticket_medio', CASE
        WHEN (SELECT pedidos FROM totais_hoje) = 0 THEN 0
        ELSE ROUND(((SELECT faturamento FROM totais_hoje) / (SELECT pedidos FROM totais_hoje))::numeric, 2)
      END,
      'produtos_vendidos', COALESCE((SELECT SUM(quantity) FROM itens_classif),0),
      'faturamento_ontem', ROUND((SELECT faturamento FROM totais_ontem)::numeric, 2),
      'variacao_percentual', CASE
        WHEN (SELECT faturamento FROM totais_ontem) = 0 THEN NULL
        ELSE ROUND(((((SELECT faturamento FROM totais_hoje) - (SELECT faturamento FROM totais_ontem))
                     / (SELECT faturamento FROM totais_ontem)) * 100)::numeric, 1)
      END
    ),
    'canais', jsonb_build_array(
      jsonb_build_object('canal','E-commerce',
        'valor', ROUND(COALESCE((SELECT SUM(valor_total) FROM shopify_paid),0)::numeric,2),
        'pedidos', (SELECT COUNT(*) FROM shopify_paid)),
      jsonb_build_object('canal','B2B Faturado',
        'valor', ROUND(COALESCE((SELECT SUM(valor_total) FROM shopify_faturado),0)::numeric,2),
        'pedidos', (SELECT COUNT(*) FROM shopify_faturado)),
      jsonb_build_object('canal','Faturamento Direto',
        'valor', ROUND(COALESCE((SELECT SUM(valor_total) FROM fat_direto),0)::numeric,2),
        'pedidos', (SELECT COUNT(*) FROM fat_direto)),
      jsonb_build_object('canal','Mercado Pago Link',
        'valor', ROUND(COALESCE((SELECT SUM(valor_total) FROM mp_link),0)::numeric,2),
        'pedidos', (SELECT COUNT(*) FROM mp_link)),
      jsonb_build_object('canal','Nova Loja CG',
        'valor', ROUND(COALESCE((SELECT SUM(valor_total) FROM nova_loja),0)::numeric,2),
        'pedidos', (SELECT COUNT(*) FROM nova_loja)),
      jsonb_build_object('canal','Mercado Livre',
        'valor', ROUND(COALESCE((SELECT SUM(valor_total) FROM mkt WHERE marketplace='MERCADO_LIVRE'),0)::numeric,2),
        'pedidos', (SELECT COUNT(*) FROM mkt WHERE marketplace='MERCADO_LIVRE')),
      jsonb_build_object('canal','Shopee',
        'valor', ROUND(COALESCE((SELECT SUM(valor_total) FROM mkt WHERE marketplace='SHOPEE'),0)::numeric,2),
        'pedidos', (SELECT COUNT(*) FROM mkt WHERE marketplace='SHOPEE')),
      jsonb_build_object('canal','Amazon',
        'valor', ROUND(COALESCE((SELECT SUM(valor_total) FROM mkt WHERE marketplace='AMAZON'),0)::numeric,2),
        'pedidos', (SELECT COUNT(*) FROM mkt WHERE marketplace='AMAZON')),
      jsonb_build_object('canal','Atacado',
        'valor', ROUND(COALESCE((SELECT SUM(valor_total) FROM mkt WHERE marketplace='ATACADO'),0)::numeric,2),
        'pedidos', (SELECT COUNT(*) FROM mkt WHERE marketplace='ATACADO')),
      jsonb_build_object('canal','ADVECS',
        'valor', ROUND(COALESCE((SELECT SUM(valor_total) FROM mkt WHERE marketplace='ADVECS'),0)::numeric,2),
        'pedidos', (SELECT COUNT(*) FROM mkt WHERE marketplace='ADVECS'))
    ),
    'vendedores_top5', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'vendedor_id', vendedor_id,
        'nome', nome,
        'foto_url', foto_url,
        'valor', valor,
        'pedidos', pedidos
      )) FROM vend_top5
    ), '[]'::jsonb),
    'mix_produtos', jsonb_build_object(
      'revistas', jsonb_build_object(
        'quantidade', COALESCE((SELECT qtd FROM mix WHERE categoria='revistas'),0),
        'valor', ROUND(COALESCE((SELECT valor FROM mix WHERE categoria='revistas'),0)::numeric,2)),
      'livros_fisicos', jsonb_build_object(
        'quantidade', COALESCE((SELECT qtd FROM mix WHERE categoria='livros_fisicos'),0),
        'valor', ROUND(COALESCE((SELECT valor FROM mix WHERE categoria='livros_fisicos'),0)::numeric,2)),
      'digitais', jsonb_build_object(
        'quantidade', COALESCE((SELECT qtd FROM mix WHERE categoria='digitais'),0),
        'valor', ROUND(COALESCE((SELECT valor FROM mix WHERE categoria='digitais'),0)::numeric,2)),
      'outros', jsonb_build_object(
        'quantidade', COALESCE((SELECT qtd FROM mix WHERE categoria='outros'),0),
        'valor', ROUND(COALESCE((SELECT valor FROM mix WHERE categoria='outros'),0)::numeric,2))
    ),
    'multi_licenca', jsonb_build_object(
      'pacotes', (SELECT pacotes FROM multi_lic),
      'valor', ROUND((SELECT valor FROM multi_lic)::numeric,2)
    ),
    'destaque_produto', (
      SELECT CASE WHEN d.title IS NULL THEN NULL
        ELSE jsonb_build_object('titulo', d.title, 'quantidade', d.qtd)
      END FROM destaque d
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_resumo_diario(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_resumo_diario(date) TO authenticated;
