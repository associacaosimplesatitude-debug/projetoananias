-- ============================================================
-- FASE 1 — RPCs unificadas para o agente IA da Loja CG
-- ============================================================

-- Helper: normalização de termo de busca (sem unaccent — fallback translate)
CREATE OR REPLACE FUNCTION public.normalizar_termo_busca(termo text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(translate(
    regexp_replace(
      regexp_replace(coalesce(termo,''), '\s*Nº\s*', ' ', 'gi'),
      '\s*n\.\s*', ' ', 'gi'
    ),
    'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaAAAAAeeeeEEEEiiiiIIIIooooOOOOOuuuuUUUUcCnN'
  ));
$$;

-- Helper: variantes de telefone (com/sem 9, com/sem 55)
CREATE OR REPLACE FUNCTION public.variantes_telefone(p_telefone text)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  d text := regexp_replace(coalesce(p_telefone,''), '[^0-9]', '', 'g');
  core text;
  arr text[] := ARRAY[]::text[];
BEGIN
  IF d = '' THEN RETURN arr; END IF;
  core := d;
  IF length(core) IN (12,13) AND substring(core,1,2) = '55' THEN
    core := substring(core, 3);
  END IF;
  arr := arr || d;
  IF length(core) = 11 THEN
    arr := arr || core;
    arr := arr || (substring(core,1,2) || substring(core,4));
    arr := arr || ('55' || core);
    arr := arr || ('55' || substring(core,1,2) || substring(core,4));
  ELSIF length(core) = 10 THEN
    arr := arr || core;
    arr := arr || (substring(core,1,2) || '9' || substring(core,3));
    arr := arr || ('55' || core);
    arr := arr || ('55' || substring(core,1,2) || '9' || substring(core,3));
  END IF;
  RETURN ARRAY(SELECT DISTINCT u FROM unnest(arr) u WHERE length(u) >= 10);
END;
$$;

-- ============================================================
-- RPC 1 — identificar_pessoa_unificada
-- ============================================================
CREATE OR REPLACE FUNCTION public.identificar_pessoa_unificada(
  p_telefone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_documento text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email,'')));
  v_doc text := regexp_replace(coalesce(p_documento,''), '[^0-9]', '', 'g');
  v_vars text[] := public.variantes_telefone(p_telefone);
  v_resultado jsonb;
BEGIN
  WITH
  ebd_match AS (
    SELECT
      'ebd_clientes' AS fonte,
      c.id AS cliente_id,
      c.nome_igreja, c.nome_responsavel, c.nome_superintendente,
      c.tipo_cliente, c.pode_faturar, c.vendedor_id,
      c.cnpj, c.cpf,
      c.email_superintendente AS email,
      c.telefone,
      c.endereco_cidade AS cidade,
      c.endereco_estado AS estado,
      c.created_at
    FROM ebd_clientes c
    WHERE
      (array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(c.telefone,''),'[^0-9]','','g') = ANY(v_vars))
      OR (v_email <> '' AND lower(trim(c.email_superintendente)) = v_email)
      OR (v_doc <> '' AND (regexp_replace(coalesce(c.cnpj,''),'[^0-9]','','g') = v_doc OR regexp_replace(coalesce(c.cpf,''),'[^0-9]','','g') = v_doc))
    LIMIT 1
  ),
  licenca_match AS (
    SELECT
      'revista_licencas_shopify' AS fonte,
      rls.id AS licenca_id, rls.nome_comprador, rls.email,
      rls.whatsapp AS telefone, rls.revista_id, rls.ativo,
      rls.created_at, rls.ultimo_acesso_em, rls.expira_em
    FROM revista_licencas_shopify rls
    WHERE
      (array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(rls.whatsapp,''),'[^0-9]','','g') = ANY(v_vars))
      OR (v_email <> '' AND lower(trim(rls.email)) = v_email)
    ORDER BY rls.created_at DESC
    LIMIT 5
  ),
  embaixadora_match AS (
    SELECT
      'embaixadoras' AS fonte,
      e.id, e.nome, e.email, e.whatsapp AS telefone, e.codigo_unico AS codigo
    FROM embaixadoras e
    WHERE
      (array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(e.whatsapp,''),'[^0-9]','','g') = ANY(v_vars))
      OR (v_email <> '' AND lower(trim(e.email)) = v_email)
    LIMIT 1
  ),
  sorteio_match AS (
    SELECT
      'sorteio_participantes' AS fonte,
      s.id, s.nome, s.email, s.whatsapp AS telefone, s.cidade, s.igreja, s.created_at
    FROM sorteio_participantes s
    WHERE
      (array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(s.whatsapp,''),'[^0-9]','','g') = ANY(v_vars))
      OR (v_email <> '' AND lower(trim(s.email)) = v_email)
    LIMIT 1
  ),
  auth_match AS (
    SELECT
      'auth_users' AS fonte,
      u.id AS user_id, u.email::text AS email, u.last_sign_in_at, u.created_at
    FROM auth.users u
    WHERE v_email <> '' AND lower(trim(u.email::text)) = v_email
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'found',
      (SELECT count(*) FROM ebd_match) > 0
      OR (SELECT count(*) FROM licenca_match) > 0
      OR (SELECT count(*) FROM embaixadora_match) > 0
      OR (SELECT count(*) FROM sorteio_match) > 0
      OR (SELECT count(*) FROM auth_match) > 0,
    'ebd_clientes', (SELECT to_jsonb(e) FROM ebd_match e),
    'licencas_shopify', COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM licenca_match l), '[]'::jsonb),
    'embaixadora', (SELECT to_jsonb(e) FROM embaixadora_match e),
    'sorteio', (SELECT to_jsonb(s) FROM sorteio_match s),
    'auth_user', (SELECT to_jsonb(a) FROM auth_match a)
  ) INTO v_resultado;
  RETURN v_resultado;
END;
$$;
GRANT EXECUTE ON FUNCTION public.identificar_pessoa_unificada(text, text, text) TO service_role, authenticated;

-- ============================================================
-- RPC 2 — historico_compras_completo
-- ============================================================
CREATE OR REPLACE FUNCTION public.historico_compras_completo(
  p_cliente_id uuid DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_limite int DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email,'')));
  v_vars text[] := public.variantes_telefone(p_telefone);
  v_resultado jsonb;
BEGIN
  WITH todos AS (
    -- Loja CG ativa
    SELECT
      'loja_atual_cg'::text AS origem,
      false AS arquivado,
      cast(id AS text) AS pedido_id,
      cliente_id,
      order_date AS data_pedido,
      coalesce(status_pagamento, status_pedido) AS status,
      valor_total,
      customer_email AS email,
      customer_phone AS telefone,
      codigo_rastreio,
      url_rastreio,
      paid_at,
      provisionamento_status
    FROM ebd_loja_pedidos_cg
    WHERE
      (p_cliente_id IS NOT NULL AND cliente_id = p_cliente_id)
      OR (array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(customer_phone,''),'[^0-9]','','g') = ANY(v_vars))
      OR (v_email <> '' AND lower(trim(customer_email)) = v_email)

    UNION ALL
    -- MP standalone
    SELECT
      'mp_standalone'::text, false,
      cast(id AS text), cliente_id, created_at,
      coalesce(payment_status, status), valor_total,
      cliente_email, cliente_telefone,
      null::text, null::text,
      CASE WHEN coalesce(payment_status,status) IN ('paid','approved','aprovado') THEN updated_at ELSE null END,
      null::text
    FROM ebd_shopify_pedidos_mercadopago
    WHERE
      (p_cliente_id IS NOT NULL AND cliente_id = p_cliente_id)
      OR (array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(cliente_telefone,''),'[^0-9]','','g') = ANY(v_vars))
      OR (v_email <> '' AND lower(trim(cliente_email)) = v_email)

    UNION ALL
    -- Histórico Shopify EBD
    SELECT
      'historico_shopify_ebd'::text, true,
      cast(id AS text), cliente_id, order_date,
      status_pagamento, valor_total,
      customer_email, customer_phone,
      codigo_rastreio, url_rastreio,
      null::timestamptz, null::text
    FROM ebd_shopify_pedidos
    WHERE
      (p_cliente_id IS NOT NULL AND cliente_id = p_cliente_id)
      OR (array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(customer_phone,''),'[^0-9]','','g') = ANY(v_vars))
      OR (v_email <> '' AND lower(trim(customer_email)) = v_email)

    UNION ALL
    -- Histórico Shopify CG
    SELECT
      'historico_shopify_cg'::text, true,
      cast(id AS text), cliente_id, order_date,
      status_pagamento, valor_total,
      customer_email, endereco_telefone,
      codigo_rastreio, url_rastreio,
      null::timestamptz, null::text
    FROM ebd_shopify_pedidos_cg
    WHERE
      (p_cliente_id IS NOT NULL AND cliente_id = p_cliente_id)
      OR (v_email <> '' AND lower(trim(customer_email)) = v_email)

    UNION ALL
    -- Propostas B2B
    SELECT
      'proposta_b2b'::text, false,
      cast(id AS text), cliente_id, created_at,
      status, valor_total,
      null::text, null::text,
      null::text, null::text,
      confirmado_em, null::text
    FROM vendedor_propostas
    WHERE p_cliente_id IS NOT NULL AND cliente_id = p_cliente_id

    UNION ALL
    -- Marketplace Bling
    SELECT
      ('marketplace_' || coalesce(marketplace, 'desconhecido'))::text, false,
      cast(id AS text), null::uuid, order_date,
      coalesce(status_pagamento, status_logistico), valor_total,
      customer_email, null::text,
      codigo_rastreio, url_rastreio,
      null::timestamptz, null::text
    FROM bling_marketplace_pedidos
    WHERE
      (v_email <> '' AND lower(trim(customer_email)) = v_email)
      OR (v_doc_match(customer_document, p_cliente_id) AND false) -- placeholder, no-op
      OR (array_length(v_vars,1) IS NOT NULL AND false)            -- bling tem só email/doc

    UNION ALL
    -- PDV
    SELECT
      'pdv_balcao'::text, false,
      cast(id AS text), null::uuid, created_at,
      status, valor_total,
      null::text, cliente_telefone,
      null::text, null::text,
      null::timestamptz, null::text
    FROM vendas_balcao
    WHERE
      (array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(cliente_telefone,''),'[^0-9]','','g') = ANY(v_vars))
  )
  SELECT jsonb_build_object(
    'total_encontrados', (SELECT count(*) FROM todos),
    'pedidos', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t.*))
       FROM (SELECT * FROM todos ORDER BY data_pedido DESC NULLS LAST LIMIT p_limite) t),
      '[]'::jsonb
    )
  ) INTO v_resultado;
  RETURN v_resultado;
END;
$$;
GRANT EXECUTE ON FUNCTION public.historico_compras_completo(uuid, text, text, int) TO service_role, authenticated;

-- ============================================================
-- RPC 3 — acessos_revista_digital
-- ============================================================
CREATE OR REPLACE FUNCTION public.acessos_revista_digital(
  p_cliente_id uuid DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_email text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email,'')));
  v_vars text[] := public.variantes_telefone(p_telefone);
  v_resultado jsonb;
BEGIN
  WITH lic_shop AS (
    SELECT
      rls.id, rls.revista_id,
      coalesce(rd.titulo, er.titulo) AS revista_titulo,
      rls.nome_comprador, rls.email, rls.whatsapp,
      rls.ativo, rls.expira_em,
      rls.primeiro_acesso_em, rls.ultimo_acesso_em, rls.created_at
    FROM revista_licencas_shopify rls
    LEFT JOIN revistas_digitais rd ON rd.id = rls.revista_id
    LEFT JOIN ebd_revistas er ON er.id = rls.revista_id
    WHERE
      (array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(rls.whatsapp,''),'[^0-9]','','g') = ANY(v_vars))
      OR (v_email <> '' AND lower(trim(rls.email)) = v_email)
    ORDER BY rls.created_at DESC
  ),
  lic_multi AS (
    SELECT
      rl.id, rl.revista_id,
      coalesce(rd.titulo, er.titulo) AS revista_titulo,
      rl.plano, rl.quantidade_total, rl.quantidade_usada,
      rl.status, rl.inicio_em, rl.expira_em, rl.created_at
    FROM revista_licencas rl
    LEFT JOIN revistas_digitais rd ON rd.id = rl.revista_id
    LEFT JOIN ebd_revistas er ON er.id = rl.revista_id
    WHERE p_cliente_id IS NOT NULL AND rl.superintendente_id = p_cliente_id
    ORDER BY rl.created_at DESC
  ),
  otps AS (
    SELECT id, whatsapp, expira_em, usado, created_at
    FROM revista_otp
    WHERE array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(whatsapp,''),'[^0-9]','','g') = ANY(v_vars)
    ORDER BY created_at DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'licencas_shopify', COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM lic_shop l), '[]'::jsonb),
    'licencas_multi', COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM lic_multi l), '[]'::jsonb),
    'total_licencas_ativas',
      (SELECT count(*) FROM lic_shop WHERE ativo IS TRUE AND (expira_em IS NULL OR expira_em > now()))
      + (SELECT count(*) FROM lic_multi WHERE status = 'ativa' AND (expira_em IS NULL OR expira_em > current_date)),
    'tem_acesso_atual',
      ((SELECT count(*) FROM lic_shop WHERE ativo IS TRUE AND (expira_em IS NULL OR expira_em > now()))
       + (SELECT count(*) FROM lic_multi WHERE status = 'ativa' AND (expira_em IS NULL OR expira_em > current_date))) > 0,
    'ultima_atividade', (SELECT max(ultimo_acesso_em) FROM lic_shop),
    'otps_recentes', COALESCE((SELECT jsonb_agg(to_jsonb(o)) FROM otps o), '[]'::jsonb)
  ) INTO v_resultado;
  RETURN v_resultado;
END;
$$;
GRANT EXECUTE ON FUNCTION public.acessos_revista_digital(uuid, text, text) TO service_role, authenticated;

-- ============================================================
-- RPC 4 — disparos_recebidos
-- ============================================================
CREATE OR REPLACE FUNCTION public.disparos_recebidos(
  p_telefone text,
  p_email text DEFAULT NULL,
  p_dias int DEFAULT 7
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email,'')));
  v_vars text[] := public.variantes_telefone(p_telefone);
  v_resultado jsonb;
  v_desde timestamptz := now() - (p_dias || ' days')::interval;
BEGIN
  WITH wa AS (
    SELECT
      tipo_mensagem, status,
      left(coalesce(mensagem,''), 200) AS mensagem,
      created_at AS enviado_em,
      jsonb_build_object('tipo', payload_enviado->>'type', 'template', payload_enviado->'template'->>'name') AS payload_resumo
    FROM whatsapp_mensagens
    WHERE created_at > v_desde
      AND array_length(v_vars,1) IS NOT NULL
      AND regexp_replace(coalesce(telefone_destino,''),'[^0-9]','','g') = ANY(v_vars)
    ORDER BY created_at DESC
  ),
  em AS (
    SELECT
      template_id, codigo_template_lookup AS codigo_template, status,
      created_at AS enviado_em, email_aberto, link_clicado
    FROM (
      SELECT el.template_id, et.codigo AS codigo_template_lookup, el.status, el.created_at, el.email_aberto, el.link_clicado
      FROM ebd_email_logs el
      LEFT JOIN ebd_email_templates et ON et.id = el.template_id
      WHERE el.created_at > v_desde
        AND v_email <> '' AND lower(trim(el.destinatario)) = v_email
    ) x
    ORDER BY created_at DESC
  )
  SELECT jsonb_build_object(
    'whatsapp', COALESCE((SELECT jsonb_agg(to_jsonb(w)) FROM wa w), '[]'::jsonb),
    'email', COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM em e), '[]'::jsonb),
    'total_whatsapp', (SELECT count(*) FROM wa),
    'total_email', (SELECT count(*) FROM em),
    'ultimo_template_whatsapp', (
      SELECT to_jsonb(w) FROM wa w
      WHERE payload_resumo->>'template' IS NOT NULL
      ORDER BY enviado_em DESC LIMIT 1
    ),
    'agente_ja_respondeu', (
      SELECT count(*) > 0 FROM wa
      WHERE tipo_mensagem IN ('agente_loja_cg','agente_ia')
        AND enviado_em > now() - interval '24 hours'
    )
  ) INTO v_resultado;
  RETURN v_resultado;
END;
$$;
GRANT EXECUTE ON FUNCTION public.disparos_recebidos(text, text, int) TO service_role, authenticated;

-- ============================================================
-- RPC 5 — cliente_em_campanha_ativa
-- ============================================================
CREATE OR REPLACE FUNCTION public.cliente_em_campanha_ativa(
  p_telefone text,
  p_cliente_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vars text[] := public.variantes_telefone(p_telefone);
  v_resultado jsonb;
BEGIN
  WITH retencao AS (
    SELECT rd.id, rd.faixa, rd.template_nome, rd.enviado_em
    FROM retencao_disparos rd
    WHERE rd.enviado_em > now() - interval '72 hours'
      AND rd.status = 'sucesso'
      AND (
        (p_cliente_id IS NOT NULL AND rd.cliente_id = p_cliente_id)
        OR (array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(rd.telefone,''),'[^0-9]','','g') = ANY(v_vars))
      )
      AND NOT EXISTS (
        SELECT 1 FROM retencao_respostas rr
        WHERE rr.created_at > rd.enviado_em
          AND ((p_cliente_id IS NOT NULL AND rr.cliente_id = p_cliente_id)
               OR (array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(rr.telefone,''),'[^0-9]','','g') = ANY(v_vars)))
      )
    ORDER BY rd.enviado_em DESC
  ),
  presente AS (
    SELECT id, tipo, licenca_concedida_em, wa_acesso_enviado_em, created_at
    FROM retencao_respostas
    WHERE tipo = 'aceitar_presente'
      AND (licenca_concedida_em IS NULL OR wa_acesso_enviado_em IS NULL)
      AND (
        (p_cliente_id IS NOT NULL AND cliente_id = p_cliente_id)
        OR (array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(telefone,''),'[^0-9]','','g') = ANY(v_vars))
      )
    ORDER BY created_at DESC
  ),
  funil AS (
    SELECT id, fase_atual, ultima_mensagem_em, concluido
    FROM funil_posv_tracking
    WHERE p_cliente_id IS NOT NULL AND cliente_id = p_cliente_id
      AND coalesce(concluido,false) = false
    ORDER BY ultima_mensagem_em DESC NULLS LAST
  ),
  links AS (
    SELECT id, token, campaign_id, customer_phone, customer_email, first_accessed_em, created_at
    FROM (
      SELECT id, token, campaign_id, customer_phone, customer_email, first_accessed_at AS first_accessed_em, created_at
      FROM campaign_links
      WHERE created_at > now() - interval '30 days'
        AND (array_length(v_vars,1) IS NOT NULL AND regexp_replace(coalesce(customer_phone,''),'[^0-9]','','g') = ANY(v_vars))
    ) x
    ORDER BY created_at DESC
  )
  SELECT jsonb_build_object(
    'retencao_ativa', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM retencao r), '[]'::jsonb),
    'presente_pendente', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM presente p), '[]'::jsonb),
    'funil_posv_ativo', COALESCE((SELECT jsonb_agg(to_jsonb(f)) FROM funil f), '[]'::jsonb),
    'campaign_links_recentes', COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM links l), '[]'::jsonb),
    'em_alguma_campanha',
      (SELECT count(*) FROM retencao) > 0
      OR (SELECT count(*) FROM presente) > 0
      OR (SELECT count(*) FROM funil) > 0
      OR (SELECT count(*) FROM links) > 0
  ) INTO v_resultado;
  RETURN v_resultado;
END;
$$;
GRANT EXECUTE ON FUNCTION public.cliente_em_campanha_ativa(text, uuid) TO service_role, authenticated;

-- ============================================================
-- RPC 6 — contexto_inicial_cliente
-- ============================================================
CREATE OR REPLACE FUNCTION public.contexto_inicial_cliente(
  p_telefone text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pessoa jsonb;
  v_cliente_id uuid;
  v_email text;
  v_historico jsonb;
  v_acessos jsonb;
  v_disparos jsonb;
  v_campanhas jsonb;
  v_inferencia jsonb;
  v_acoes text[] := ARRAY[]::text[];
  v_motivo text := 'desconhecido';
  v_total_pedidos int := 0;
  v_ultimo_pedido timestamptz;
  v_ultimo_template jsonb;
  v_tem_licenca boolean;
  v_recorrente boolean;
  v_inativo boolean;
BEGIN
  v_pessoa := public.identificar_pessoa_unificada(p_telefone, NULL, NULL);
  v_cliente_id := nullif(v_pessoa->'ebd_clientes'->>'cliente_id','')::uuid;
  v_email := coalesce(v_pessoa->'ebd_clientes'->>'email', v_pessoa->'licencas_shopify'->0->>'email');

  v_historico := public.historico_compras_completo(v_cliente_id, p_telefone, v_email, 3);
  v_acessos := public.acessos_revista_digital(v_cliente_id, p_telefone, v_email);
  v_disparos := public.disparos_recebidos(p_telefone, v_email, 3);
  v_campanhas := public.cliente_em_campanha_ativa(p_telefone, v_cliente_id);

  v_total_pedidos := coalesce((v_historico->>'total_encontrados')::int, 0);
  v_ultimo_pedido := nullif(v_historico->'pedidos'->0->>'data_pedido','')::timestamptz;
  v_ultimo_template := v_disparos->'ultimo_template_whatsapp';
  v_tem_licenca := coalesce((v_acessos->>'tem_acesso_atual')::boolean, false);
  v_recorrente := v_total_pedidos >= 2;
  v_inativo := v_ultimo_pedido IS NULL OR v_ultimo_pedido < now() - interval '90 days';

  -- Inferência de motivo provável
  IF v_ultimo_template IS NOT NULL AND (v_ultimo_template->>'enviado_em')::timestamptz > now() - interval '6 hours' THEN
    v_motivo := 'recebeu template ' || coalesce(v_ultimo_template->'payload_resumo'->>'template', v_ultimo_template->>'tipo_mensagem','?')
                || ' recentemente — provavelmente está respondendo';
  ELSIF coalesce((v_campanhas->>'em_alguma_campanha')::boolean, false) THEN
    v_motivo := 'cliente está em campanha ativa (retenção/funil/presente)';
  ELSIF v_tem_licenca AND coalesce(jsonb_array_length(v_acessos->'otps_recentes'),0) > 0 THEN
    v_motivo := 'tem licença ativa e OTPs recentes — provavelmente quer ajuda pra acessar a revista';
  ELSIF v_total_pedidos > 0 AND v_ultimo_pedido > now() - interval '30 days' THEN
    v_motivo := 'pedido recente — possivelmente status, rastreio ou nota fiscal';
  ELSIF v_total_pedidos = 0 THEN
    v_motivo := 'nenhum pedido — provavelmente lead novo querendo informação ou comprar';
  END IF;

  -- Ações sugeridas
  IF coalesce(jsonb_array_length(v_campanhas->'presente_pendente'),0) > 0 THEN
    v_acoes := v_acoes || 'liberar_presente_pendente';
  END IF;
  IF v_tem_licenca AND coalesce(jsonb_array_length(v_acessos->'otps_recentes'),0) > 0
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_acessos->'otps_recentes') o WHERE (o->>'usado')::boolean = true) THEN
    v_acoes := v_acoes || 'reenviar_otp_revista';
  END IF;
  IF coalesce(jsonb_array_length(v_campanhas->'retencao_ativa'),0) > 0 THEN
    v_acoes := v_acoes || 'verificar_resposta_retencao';
  END IF;

  v_inferencia := jsonb_build_object(
    'provavel_motivo_contato', v_motivo,
    'cliente_recorrente', v_recorrente,
    'cliente_inativo', v_inativo,
    'tem_licenca_ativa', v_tem_licenca,
    'precisa_acao_imediata', to_jsonb(v_acoes)
  );

  RETURN jsonb_build_object(
    'pessoa', v_pessoa,
    'historico', jsonb_build_object(
      'total', v_total_pedidos,
      'ultimos_3', v_historico->'pedidos'
    ),
    'acessos', jsonb_build_object(
      'total_licencas_ativas', v_acessos->'total_licencas_ativas',
      'tem_acesso_atual', v_acessos->'tem_acesso_atual',
      'ultima_atividade', v_acessos->'ultima_atividade',
      'otps_recentes_count', coalesce(jsonb_array_length(v_acessos->'otps_recentes'),0)
    ),
    'disparos_recentes', jsonb_build_object(
      'total_whatsapp', v_disparos->'total_whatsapp',
      'total_email', v_disparos->'total_email',
      'ultimo_template_whatsapp', v_disparos->'ultimo_template_whatsapp',
      'agente_ja_respondeu', v_disparos->'agente_ja_respondeu'
    ),
    'campanhas_ativas', v_campanhas,
    'inferencia', v_inferencia
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.contexto_inicial_cliente(text) TO service_role, authenticated;

-- ============================================================
-- RPC 7 — buscar_catalogo_unificado
-- ============================================================
CREATE OR REPLACE FUNCTION public.buscar_catalogo_unificado(
  p_termo text,
  p_max int DEFAULT 5
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text := public.normalizar_termo_busca(p_termo);
  v_resultado jsonb;
BEGIN
  IF v_norm IS NULL OR length(trim(v_norm)) = 0 THEN
    RETURN jsonb_build_object('items','[]'::jsonb,'total_encontrados',0);
  END IF;

  WITH fisicas AS (
    SELECT
      'ebd_revistas'::text AS fonte,
      r.id, r.titulo, r.preco_cheio AS preco, r.imagem_url,
      null::text AS sku, r.categoria, r.estoque,
      coalesce(r.estoque,0) > 0 AS disponivel
    FROM ebd_revistas r
    WHERE public.normalizar_termo_busca(r.titulo) ILIKE '%' || v_norm || '%'
    LIMIT p_max
  ),
  digitais AS (
    SELECT
      'revistas_digitais'::text AS fonte,
      rd.id, rd.titulo, null::numeric AS preco, rd.capa_url AS imagem_url,
      null::text AS sku, rd.tipo AS categoria, null::int AS estoque,
      coalesce(rd.ativo,false) AS disponivel
    FROM revistas_digitais rd
    WHERE public.normalizar_termo_busca(rd.titulo) ILIKE '%' || v_norm || '%'
    LIMIT p_max
  ),
  todos AS (
    SELECT * FROM fisicas
    UNION ALL
    SELECT * FROM digitais
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT * FROM todos LIMIT p_max) t), '[]'::jsonb),
    'total_encontrados', (SELECT count(*) FROM todos)
  ) INTO v_resultado;
  RETURN v_resultado;
END;
$$;
GRANT EXECUTE ON FUNCTION public.buscar_catalogo_unificado(text, int) TO service_role, authenticated;