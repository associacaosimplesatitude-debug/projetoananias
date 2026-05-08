
-- ============================================================
-- 1) VENDEDOR VIRTUAL "Agente IA Central Gospel"
-- ============================================================

-- Estender o CHECK de tipo_perfil para aceitar 'agente_ia'
ALTER TABLE public.vendedores DROP CONSTRAINT IF EXISTS vendedores_tipo_perfil_check;
ALTER TABLE public.vendedores ADD CONSTRAINT vendedores_tipo_perfil_check
  CHECK (tipo_perfil = ANY (ARRAY['vendedor'::text, 'representante'::text, 'agente_ia'::text]));

-- Inserir o vendedor virtual e salvar o id em system_settings
DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.vendedores WHERE email = 'agente-ia@centralgospel.com.br' LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.vendedores (id, nome, email, status, tipo_perfil, comissao_percentual, is_gerente, created_at)
    VALUES (gen_random_uuid(), 'Agente IA Central Gospel', 'agente-ia@centralgospel.com.br',
            'Ativo', 'agente_ia', 0, false, now())
    RETURNING id INTO v_id;
  END IF;

  INSERT INTO public.system_settings (key, value)
  VALUES ('agente_ia_vendedor_id', to_jsonb(v_id::text))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END $$;

-- ============================================================
-- 2) COLUNA origem_venda em vendedor_propostas
-- ============================================================
ALTER TABLE public.vendedor_propostas
  ADD COLUMN IF NOT EXISTS origem_venda text;

COMMENT ON COLUMN public.vendedor_propostas.origem_venda IS
  'Origem da venda: vendedor_humano | agente_ia | site_organico | google_ads | meta_ads | embaixadora | outro';

CREATE INDEX IF NOT EXISTS idx_vendedor_propostas_origem_venda
  ON public.vendedor_propostas(origem_venda);

-- ============================================================
-- 3) RPC calcular_preco_para_cliente
-- ============================================================
CREATE OR REPLACE FUNCTION public.calcular_preco_para_cliente(
  p_cliente_id uuid,
  p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tipo_cliente text;
  v_pode_faturar boolean;
  v_onboarding_concluido boolean;
  v_subtotal numeric := 0;
  v_total_produtos numeric := 0;
  v_desconto_total numeric := 0;
  v_regra text := 'Sem desconto';
  v_items_calculados jsonb := '[]'::jsonb;
  v_descontos_categoria jsonb := '{}'::jsonb;
  v_has_categoria boolean := false;
  v_item jsonb;
  v_titulo text;
  v_titulo_lower text;
  v_qty numeric;
  v_price numeric;
  v_categoria text;
  v_desc_pct numeric;
  v_subtotal_item numeric;
  v_desconto_item numeric;
  v_total_item numeric;
  v_setup_pct numeric := 0;
  v_setup_faixa text := '';
  v_revendedor_pct numeric := 0;
  v_revendedor_faixa text := '';
  v_is_advec boolean := false;
  v_is_igreja boolean := false;
  v_is_revendedor boolean := false;
  v_is_advec_50 boolean;
BEGIN
  -- Caso items vazio
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object(
      'subtotal', 0, 'desconto_aplicado', 0, 'regra_aplicada', 'Sem itens',
      'total_produtos', 0, 'items_calculados', '[]'::jsonb
    );
  END IF;

  -- Buscar dados do cliente
  IF p_cliente_id IS NOT NULL THEN
    SELECT tipo_cliente, pode_faturar, onboarding_concluido
      INTO v_tipo_cliente, v_pode_faturar, v_onboarding_concluido
      FROM public.ebd_clientes WHERE id = p_cliente_id;

    -- Buscar descontos por categoria
    SELECT jsonb_object_agg(categoria, percentual_desconto)
      INTO v_descontos_categoria
      FROM public.ebd_descontos_categoria_representante
      WHERE cliente_id = p_cliente_id AND COALESCE(percentual_desconto,0) > 0;

    IF v_descontos_categoria IS NOT NULL AND v_descontos_categoria <> '{}'::jsonb THEN
      v_has_categoria := true;
    END IF;
  END IF;

  v_is_advec := v_tipo_cliente IS NOT NULL AND UPPER(v_tipo_cliente) LIKE '%ADVEC%';
  v_is_igreja := v_tipo_cliente IS NOT NULL
                 AND (UPPER(v_tipo_cliente) LIKE '%IGREJA%'
                      OR UPPER(v_tipo_cliente) LIKE '%CNPJ%'
                      OR UPPER(v_tipo_cliente) LIKE '%CPF%')
                 AND NOT v_is_advec;
  v_is_revendedor := v_tipo_cliente IS NOT NULL
                     AND (UPPER(v_tipo_cliente) LIKE '%REVENDEDOR%'
                          OR UPPER(v_tipo_cliente) LIKE '%LOJISTA%');

  -- Subtotal bruto
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_price := COALESCE((v_item->>'price')::numeric, 0);
    v_qty := COALESCE((v_item->>'quantity')::numeric, 0);
    v_subtotal := v_subtotal + (v_price * v_qty);
  END LOOP;

  -- Determinar regra aplicada (prioridade)
  IF v_has_categoria THEN
    v_regra := 'Categoria customizada';
  ELSIF v_is_advec THEN
    v_regra := 'ADVEC 40% (50% em títulos especiais)';
  ELSIF v_is_igreja AND COALESCE(v_onboarding_concluido, false) THEN
    IF v_subtotal >= 501 THEN v_setup_pct := 30; v_setup_faixa := 'Premium (30%)';
    ELSIF v_subtotal >= 301 THEN v_setup_pct := 25; v_setup_faixa := 'Avançado (25%)';
    ELSIF v_subtotal > 0 THEN v_setup_pct := 20; v_setup_faixa := 'Básico (20%)';
    END IF;
    v_regra := CASE WHEN v_setup_pct > 0 THEN 'Igreja Setup ' || v_setup_faixa ELSE 'Sem desconto' END;
  ELSIF v_is_revendedor THEN
    IF v_subtotal >= 699.90 THEN v_revendedor_pct := 30; v_revendedor_faixa := 'Ouro (30%)';
    ELSIF v_subtotal >= 499.90 THEN v_revendedor_pct := 25; v_revendedor_faixa := 'Prata (25%)';
    ELSIF v_subtotal >= 299.90 THEN v_revendedor_pct := 20; v_revendedor_faixa := 'Bronze (20%)';
    END IF;
    v_regra := CASE WHEN v_revendedor_pct > 0 THEN 'Revendedor ' || v_revendedor_faixa ELSE 'Sem desconto' END;
  END IF;

  -- Iterar itens aplicando desconto
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_titulo := COALESCE(v_item->>'title', '');
    v_titulo_lower := LOWER(v_titulo);
    v_price := COALESCE((v_item->>'price')::numeric, 0);
    v_qty := COALESCE((v_item->>'quantity')::numeric, 0);
    v_subtotal_item := v_price * v_qty;

    -- Categorização
    IF v_titulo_lower LIKE '%revista%' OR v_titulo_lower LIKE '%ebd%'
       OR v_titulo_lower LIKE '%estudo bíblico%' OR v_titulo_lower LIKE '%estudo biblico%'
       OR v_titulo_lower LIKE '%kit do professor%' OR v_titulo_lower LIKE '%kit professor%'
       OR v_titulo_lower LIKE '%infografico%' THEN
      v_categoria := 'revistas';
    ELSIF v_titulo_lower LIKE '%bíblia%' OR v_titulo_lower LIKE '%biblia%' THEN
      v_categoria := 'biblias';
    ELSIF v_titulo_lower LIKE '%perfume%' OR v_titulo_lower LIKE '%fragrância%' OR v_titulo_lower LIKE '%fragrancia%' THEN
      v_categoria := 'perfumes';
    ELSIF v_titulo_lower LIKE '%infantil%' OR v_titulo_lower LIKE '%criança%' OR v_titulo_lower LIKE '%crianca%'
          OR v_titulo_lower LIKE '%kids%' OR v_titulo_lower LIKE '%colorir%' THEN
      v_categoria := 'infantil';
    ELSIF v_titulo_lower LIKE '%livro%' OR v_titulo_lower LIKE '%devocional%'
          OR v_titulo_lower LIKE '%comentário%' OR v_titulo_lower LIKE '%comentario%' THEN
      v_categoria := 'livros';
    ELSE
      v_categoria := 'outros';
    END IF;

    -- Determinar % de desconto do item
    v_desc_pct := 0;
    IF v_has_categoria THEN
      v_desc_pct := COALESCE((v_descontos_categoria->>v_categoria)::numeric, 0);
    ELSIF v_is_advec THEN
      v_is_advec_50 := v_titulo_lower LIKE '%evangelho de joão%'
                       OR v_titulo_lower LIKE '%evangelho de joao%'
                       OR v_titulo_lower LIKE '%milagre do novo nascimento%'
                       OR v_titulo_lower LIKE '%carta aos efésios%'
                       OR v_titulo_lower LIKE '%carta aos efesios%';
      v_desc_pct := CASE WHEN v_is_advec_50 THEN 50 ELSE 40 END;
    ELSIF v_is_igreja AND v_setup_pct > 0 THEN
      v_desc_pct := v_setup_pct;
    ELSIF v_is_revendedor AND v_revendedor_pct > 0 THEN
      v_desc_pct := v_revendedor_pct;
    END IF;

    v_desconto_item := ROUND((v_subtotal_item * v_desc_pct / 100)::numeric, 2);
    v_total_item := v_subtotal_item - v_desconto_item;

    v_total_produtos := v_total_produtos + v_total_item;
    v_desconto_total := v_desconto_total + v_desconto_item;

    v_items_calculados := v_items_calculados || jsonb_build_object(
      'variantId', v_item->>'variantId',
      'title', v_titulo,
      'quantity', v_qty,
      'preco_unitario', v_price,
      'categoria', v_categoria,
      'desconto_percentual_item', v_desc_pct,
      'subtotal_item', v_subtotal_item,
      'desconto_item', v_desconto_item,
      'total_item', v_total_item
    );
  END LOOP;

  RETURN jsonb_build_object(
    'subtotal', v_subtotal,
    'desconto_aplicado', v_desconto_total,
    'regra_aplicada', v_regra,
    'total_produtos', v_total_produtos,
    'items_calculados', v_items_calculados
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.calcular_preco_para_cliente(uuid, jsonb) TO service_role, authenticated;

-- ============================================================
-- 4) TABELAS DE SESSÃO DO AGENTE
-- ============================================================
CREATE TABLE public.agente_ia_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.ebd_clientes(id),
  telefone text NOT NULL,
  whatsapp_conversa_id uuid REFERENCES public.whatsapp_conversas(id),
  status text NOT NULL DEFAULT 'ativa'
    CHECK (status IN ('ativa', 'pausada_humano', 'fechada', 'escalada')),
  motivo_pausa text,
  iniciada_em timestamptz NOT NULL DEFAULT now(),
  ultima_mensagem_em timestamptz NOT NULL DEFAULT now(),
  fechada_em timestamptz,
  resolveu_sozinho boolean,
  gerou_venda boolean DEFAULT false,
  proposta_id uuid REFERENCES public.vendedor_propostas(id),
  valor_venda numeric(10,2),
  total_turnos integer DEFAULT 0,
  total_tokens_in integer DEFAULT 0,
  total_tokens_out integer DEFAULT 0,
  custo_estimado numeric(10,4) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agente_ia_conversas_cliente ON public.agente_ia_conversas(cliente_id);
CREATE INDEX idx_agente_ia_conversas_telefone ON public.agente_ia_conversas(telefone);
CREATE INDEX idx_agente_ia_conversas_status ON public.agente_ia_conversas(status);
CREATE INDEX idx_agente_ia_conversas_iniciada ON public.agente_ia_conversas(iniciada_em DESC);
ALTER TABLE public.agente_ia_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_gerente_leem_conversas_agente"
  ON public.agente_ia_conversas FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
         OR public.has_role(auth.uid(), 'gerente_ebd'::public.app_role));

CREATE POLICY "vendedor_le_conversas_seus_clientes"
  ON public.agente_ia_conversas FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.ebd_clientes c
    JOIN public.vendedores v ON v.id = c.vendedor_id
    WHERE c.id = agente_ia_conversas.cliente_id
      AND v.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  ));

CREATE TABLE public.agente_ia_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.agente_ia_conversas(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
  conteudo text,
  tool_name text,
  tool_input jsonb,
  tool_output jsonb,
  tokens_in integer,
  tokens_out integer,
  status_aprovacao text DEFAULT 'pendente'
    CHECK (status_aprovacao IN ('pendente', 'aprovada', 'editada', 'recusada', 'enviada_auto', 'nao_aplicavel')),
  aprovada_por uuid REFERENCES auth.users(id),
  aprovada_em timestamptz,
  conteudo_editado text,
  motivo_recusa text,
  enviada_ao_cliente_em timestamptz,
  meta_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agente_ia_mensagens_conversa ON public.agente_ia_mensagens(conversa_id, created_at);
CREATE INDEX idx_agente_ia_mensagens_aprovacao ON public.agente_ia_mensagens(status_aprovacao)
  WHERE status_aprovacao = 'pendente';
ALTER TABLE public.agente_ia_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_gerente_leem_mensagens_agente"
  ON public.agente_ia_mensagens FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
         OR public.has_role(auth.uid(), 'gerente_ebd'::public.app_role));

CREATE POLICY "vendedor_aprova_mensagens_agente_pendentes"
  ON public.agente_ia_mensagens FOR UPDATE
  USING (
    status_aprovacao = 'pendente'
    AND EXISTS (
      SELECT 1 FROM public.agente_ia_conversas c
      JOIN public.ebd_clientes cl ON cl.id = c.cliente_id
      JOIN public.vendedores v ON v.id = cl.vendedor_id
      WHERE c.id = agente_ia_mensagens.conversa_id
        AND v.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE TABLE public.agente_ia_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.agente_ia_conversas(id),
  cliente_id uuid REFERENCES public.ebd_clientes(id),
  vendedor_alvo_id uuid REFERENCES public.vendedores(id),
  motivo text NOT NULL CHECK (motivo IN (
    'cliente_solicitou_humano','reembolso_devolucao_troca','produto_defeituoso',
    'cancelamento_pedido_pago','alteracao_nfe','cliente_emocional','fora_de_escopo',
    'limite_turnos_excedido','erro_tecnico_persistente','outro'
  )),
  detalhes text,
  prioridade text NOT NULL DEFAULT 'normal'
    CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  status text NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'em_atendimento', 'resolvida', 'cancelada')),
  resolvida_em timestamptz,
  resolvida_por uuid REFERENCES public.vendedores(id),
  resolucao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agente_ia_escalations_status ON public.agente_ia_escalations(status);
CREATE INDEX idx_agente_ia_escalations_vendedor ON public.agente_ia_escalations(vendedor_alvo_id)
  WHERE status IN ('aberta', 'em_atendimento');
CREATE INDEX idx_agente_ia_escalations_prioridade ON public.agente_ia_escalations(prioridade, created_at DESC)
  WHERE status = 'aberta';
ALTER TABLE public.agente_ia_escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_gerente_veem_todas_escalations"
  ON public.agente_ia_escalations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
         OR public.has_role(auth.uid(), 'gerente_ebd'::public.app_role));

CREATE POLICY "vendedor_ve_proprias_escalations"
  ON public.agente_ia_escalations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.vendedores v
    WHERE v.id = agente_ia_escalations.vendedor_alvo_id
      AND v.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  ));

CREATE POLICY "vendedor_atualiza_proprias_escalations"
  ON public.agente_ia_escalations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.vendedores v
    WHERE v.id = agente_ia_escalations.vendedor_alvo_id
      AND v.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  ));
