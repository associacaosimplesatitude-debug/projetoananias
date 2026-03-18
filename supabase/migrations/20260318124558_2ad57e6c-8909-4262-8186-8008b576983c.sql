
-- 1. Tabela de contatos de retenção
CREATE TABLE public.ebd_retencao_contatos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid REFERENCES public.ebd_clientes(id) ON DELETE CASCADE NOT NULL,
  vendedor_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
  data_contato timestamptz DEFAULT now() NOT NULL,
  tipo_contato text NOT NULL, -- 'whatsapp', 'ligacao', 'email', 'visita'
  resultado text NOT NULL, -- 'retorno_agendado', 'comprou', 'nao_quer_mais', 'sem_resposta'
  motivo_perda text, -- preenchido quando resultado = 'nao_quer_mais'
  observacao text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Índices
CREATE INDEX idx_retencao_contatos_cliente ON public.ebd_retencao_contatos(cliente_id);
CREATE INDEX idx_retencao_contatos_vendedor ON public.ebd_retencao_contatos(vendedor_id);
CREATE INDEX idx_retencao_contatos_data ON public.ebd_retencao_contatos(data_contato DESC);

-- 3. RLS
ALTER TABLE public.ebd_retencao_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e gerente_ebd podem ver todos contatos"
  ON public.ebd_retencao_contatos FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gerente_ebd')
  );

CREATE POLICY "Vendedores podem ver seus contatos"
  ON public.ebd_retencao_contatos FOR SELECT
  TO authenticated
  USING (
    vendedor_id IN (
      SELECT id FROM public.vendedores WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admin e gerente_ebd podem inserir contatos"
  ON public.ebd_retencao_contatos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gerente_ebd')
  );

CREATE POLICY "Vendedores podem inserir contatos para seus clientes"
  ON public.ebd_retencao_contatos FOR INSERT
  TO authenticated
  WITH CHECK (
    vendedor_id IN (
      SELECT id FROM public.vendedores WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- 4. RPC get_retencao_dashboard
CREATE OR REPLACE FUNCTION public.get_retencao_dashboard(p_vendedor_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  result json;
BEGIN
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
  )
  SELECT json_build_object(
    'faixas', json_build_object(
      'verde', (SELECT COUNT(*) FROM com_dias WHERE dias_sem_compra <= 30),
      'amarelo', (SELECT COUNT(*) FROM com_dias WHERE dias_sem_compra > 30 AND dias_sem_compra <= 60),
      'vermelho', (SELECT COUNT(*) FROM com_dias WHERE dias_sem_compra > 60 AND dias_sem_compra <= 90),
      'perdido', (SELECT COUNT(*) FROM com_dias WHERE dias_sem_compra > 90)
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
$func$;
