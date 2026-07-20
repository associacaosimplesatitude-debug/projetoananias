
CREATE OR REPLACE VIEW public.whatsapp_contatos_360 AS
WITH src_clientes AS (
  SELECT normalizar_telefone_whatsapp(ebd_clientes.telefone) AS telefone,
    ebd_clientes.id AS cliente_id,
    ebd_clientes.nome_superintendente AS nome,
    ebd_clientes.email_superintendente AS email,
    ebd_clientes.tipo_cliente,
    ebd_clientes.possui_cnpj
  FROM ebd_clientes
  WHERE ebd_clientes.telefone IS NOT NULL
), clientes AS (
  SELECT * FROM src_clientes WHERE telefone IS NOT NULL
), clientes_agg AS (
  SELECT clientes.telefone,
    (array_agg(clientes.cliente_id ORDER BY clientes.cliente_id))[1] AS cliente_id,
    (array_agg(clientes.nome) FILTER (WHERE clientes.nome IS NOT NULL))[1] AS nome,
    (array_agg(clientes.email) FILTER (WHERE clientes.email IS NOT NULL))[1] AS email,
    bool_or(upper(COALESCE(clientes.tipo_cliente, '')) = ANY (ARRAY['ADVECS','IGREJA ADVECS'])) AS is_advec,
    bool_or(upper(COALESCE(clientes.tipo_cliente, '')) LIKE '%IGREJA CNPJ%' OR (clientes.possui_cnpj = true AND upper(COALESCE(clientes.tipo_cliente, '')) LIKE '%IGREJA%')) AS is_igreja_cnpj,
    bool_or(upper(COALESCE(clientes.tipo_cliente, '')) LIKE '%IGREJA CPF%' OR (clientes.possui_cnpj = false AND upper(COALESCE(clientes.tipo_cliente, '')) LIKE '%IGREJA%')) AS is_igreja_cpf,
    bool_or(
      upper(COALESCE(clientes.tipo_cliente, '')) LIKE '%PESSOA FÍSICA%'
      OR upper(COALESCE(clientes.tipo_cliente, '')) LIKE '%PESSOA FISICA%'
    ) AS is_pessoa_fisica,
    bool_or(upper(COALESCE(clientes.tipo_cliente, '')) LIKE '%REVENDEDOR%') AS is_revendedor,
    bool_or(upper(COALESCE(clientes.tipo_cliente, '')) LIKE '%LOJISTA%') AS is_lojista,
    bool_or(upper(COALESCE(clientes.tipo_cliente, '')) LIKE '%REPRESENTANTE%') AS is_representante
  FROM clientes
  GROUP BY clientes.telefone
), ped_shopify AS (
  SELECT normalizar_telefone_whatsapp(customer_phone) AS telefone, customer_name AS nome, customer_email AS email, order_date AS data_pedido
  FROM ebd_shopify_pedidos WHERE status_pagamento = ANY (ARRAY['paid','Faturado'])
), shopify_agg AS (
  SELECT telefone,
    (array_agg(nome) FILTER (WHERE nome IS NOT NULL))[1] AS nome,
    (array_agg(email) FILTER (WHERE email IS NOT NULL))[1] AS email,
    max(data_pedido) AS ultima, count(*) AS qtd
  FROM ped_shopify WHERE telefone IS NOT NULL GROUP BY telefone
), ped_shopify_cg AS (
  SELECT normalizar_telefone_whatsapp(endereco_telefone) AS telefone, customer_name AS nome, customer_email AS email, order_date AS data_pedido
  FROM ebd_shopify_pedidos_cg WHERE status_pagamento = 'paid'
), shopify_cg_agg AS (
  SELECT telefone,
    (array_agg(nome) FILTER (WHERE nome IS NOT NULL))[1] AS nome,
    (array_agg(email) FILTER (WHERE email IS NOT NULL))[1] AS email,
    max(data_pedido) AS ultima, count(*) AS qtd
  FROM ped_shopify_cg WHERE telefone IS NOT NULL GROUP BY telefone
), ped_loja_cg AS (
  SELECT normalizar_telefone_whatsapp(customer_phone) AS telefone, customer_name AS nome, customer_email AS email, COALESCE(paid_at, order_date) AS data_pedido
  FROM ebd_loja_pedidos_cg WHERE status_pagamento = 'paid'
), loja_cg_agg AS (
  SELECT telefone,
    (array_agg(nome) FILTER (WHERE nome IS NOT NULL))[1] AS nome,
    (array_agg(email) FILTER (WHERE email IS NOT NULL))[1] AS email,
    max(data_pedido) AS ultima, count(*) AS qtd
  FROM ped_loja_cg WHERE telefone IS NOT NULL GROUP BY telefone
), ped_ebd AS (
  SELECT normalizar_telefone_whatsapp(telefone_cliente) AS telefone,
    TRIM(BOTH FROM (COALESCE(nome_cliente,'') || ' ') || COALESCE(sobrenome_cliente,'')) AS nome,
    email_cliente AS email, approved_at AS data_pedido
  FROM ebd_pedidos WHERE payment_status = 'approved'
), ebd_agg AS (
  SELECT telefone,
    (array_agg(NULLIF(nome, '')) FILTER (WHERE nome IS NOT NULL AND nome <> ''))[1] AS nome,
    (array_agg(email) FILTER (WHERE email IS NOT NULL))[1] AS email,
    max(data_pedido) AS ultima, count(*) AS qtd
  FROM ped_ebd WHERE telefone IS NOT NULL GROUP BY telefone
), ecom_phones AS (
  SELECT normalizar_telefone_whatsapp(customer_phone) AS telefone FROM ebd_shopify_pedidos
  UNION SELECT normalizar_telefone_whatsapp(endereco_telefone) FROM ebd_shopify_pedidos_cg
  UNION SELECT normalizar_telefone_whatsapp(customer_phone) FROM ebd_loja_pedidos_cg
), ecom_set AS (
  SELECT DISTINCT telefone FROM ecom_phones WHERE telefone IS NOT NULL
), lic_shopify AS (
  SELECT DISTINCT normalizar_telefone_whatsapp(whatsapp) AS telefone FROM revista_licencas_shopify WHERE whatsapp IS NOT NULL
), lic_clientes AS (
  SELECT DISTINCT normalizar_telefone_whatsapp(c_1.telefone) AS telefone
  FROM revista_licencas rl JOIN ebd_clientes c_1 ON c_1.id = rl.superintendente_id
  WHERE c_1.telefone IS NOT NULL
), lic_set AS (
  SELECT telefone FROM lic_shopify WHERE telefone IS NOT NULL
  UNION SELECT telefone FROM lic_clientes WHERE telefone IS NOT NULL
), todos AS (
  SELECT telefone FROM clientes_agg
  UNION SELECT telefone FROM shopify_agg
  UNION SELECT telefone FROM shopify_cg_agg
  UNION SELECT telefone FROM loja_cg_agg
  UNION SELECT telefone FROM ebd_agg
  UNION SELECT telefone FROM ecom_set
  UNION SELECT telefone FROM lic_set
)
SELECT t.telefone,
  COALESCE(c.nome, scg.nome, sh.nome, lcg.nome, eb.nome) AS nome,
  COALESCE(c.email, scg.email, sh.email, lcg.email, eb.email::text) AS email,
  c.cliente_id,
  COALESCE(c.is_advec, false) AS is_advec,
  COALESCE(c.is_igreja_cnpj, false) AS is_igreja_cnpj,
  COALESCE(c.is_igreja_cpf, false) AS is_igreja_cpf,
  ec.telefone IS NOT NULL AS is_ecommerce,
  ls.telefone IS NOT NULL AS is_licenciado_revista,
  GREATEST(COALESCE(sh.ultima, '1970-01-01 00:00:00+00'::timestamptz), COALESCE(scg.ultima, '1970-01-01 00:00:00+00'::timestamptz), COALESCE(lcg.ultima, '1970-01-01 00:00:00+00'::timestamptz), COALESCE(eb.ultima, '1970-01-01 00:00:00+00'::timestamptz)) AS ultima_compra_em_raw,
  NULLIF(GREATEST(COALESCE(sh.ultima, '1970-01-01 00:00:00+00'::timestamptz), COALESCE(scg.ultima, '1970-01-01 00:00:00+00'::timestamptz), COALESCE(lcg.ultima, '1970-01-01 00:00:00+00'::timestamptz), COALESCE(eb.ultima, '1970-01-01 00:00:00+00'::timestamptz)), '1970-01-01 00:00:00+00'::timestamptz) AS ultima_compra_em,
  CASE WHEN GREATEST(COALESCE(sh.ultima, '1970-01-01 00:00:00+00'::timestamptz), COALESCE(scg.ultima, '1970-01-01 00:00:00+00'::timestamptz), COALESCE(lcg.ultima, '1970-01-01 00:00:00+00'::timestamptz), COALESCE(eb.ultima, '1970-01-01 00:00:00+00'::timestamptz)) = '1970-01-01 00:00:00+00'::timestamptz THEN NULL
    ELSE EXTRACT(day FROM now() - GREATEST(COALESCE(sh.ultima, '1970-01-01 00:00:00+00'::timestamptz), COALESCE(scg.ultima, '1970-01-01 00:00:00+00'::timestamptz), COALESCE(lcg.ultima, '1970-01-01 00:00:00+00'::timestamptz), COALESCE(eb.ultima, '1970-01-01 00:00:00+00'::timestamptz)))::integer
  END AS dias_sem_comprar,
  (COALESCE(sh.qtd,0) + COALESCE(scg.qtd,0) + COALESCE(lcg.qtd,0) + COALESCE(eb.qtd,0))::integer AS total_pedidos,
  oo.telefone IS NOT NULL AS tem_optout,
  COALESCE(c.is_pessoa_fisica, false) AS is_pessoa_fisica,
  COALESCE(c.is_revendedor, false) AS is_revendedor,
  COALESCE(c.is_lojista, false) AS is_lojista,
  COALESCE(c.is_representante, false) AS is_representante
FROM todos t
  LEFT JOIN clientes_agg c ON c.telefone = t.telefone
  LEFT JOIN shopify_agg sh ON sh.telefone = t.telefone
  LEFT JOIN shopify_cg_agg scg ON scg.telefone = t.telefone
  LEFT JOIN loja_cg_agg lcg ON lcg.telefone = t.telefone
  LEFT JOIN ebd_agg eb ON eb.telefone = t.telefone
  LEFT JOIN ecom_set ec ON ec.telefone = t.telefone
  LEFT JOIN lic_set ls ON ls.telefone = t.telefone
  LEFT JOIN whatsapp_optouts oo ON oo.telefone = t.telefone;

CREATE OR REPLACE FUNCTION public.whatsapp_publico_materializar(filtros jsonb, limite integer DEFAULT NULL::integer)
 RETURNS TABLE(telefone text, nome text, email text, cliente_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_segmentos text[];
  v_logica text;
  v_rec_tipo text;
  v_rec_dias int;
  v_incluir_sem_compras boolean;
  v_excluir_optout boolean;
  v_has_advec boolean;
  v_has_igreja_cnpj boolean;
  v_has_igreja_cpf boolean;
  v_has_ecommerce boolean;
  v_has_licenciado boolean;
  v_has_pessoa_fisica boolean;
  v_has_revendedor boolean;
  v_has_lojista boolean;
  v_has_representante boolean;
BEGIN
  IF NOT (
    auth.uid() IS NULL
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: requer superadmin';
  END IF;

  v_segmentos := COALESCE(ARRAY(SELECT jsonb_array_elements_text(filtros->'segmentos')), ARRAY[]::text[]);
  v_logica := COALESCE(filtros->>'segmentos_logica', 'or');
  v_rec_tipo := COALESCE(filtros->>'recencia_tipo', 'qualquer');
  v_rec_dias := COALESCE((filtros->>'recencia_dias')::int, 60);
  v_incluir_sem_compras := COALESCE((filtros->>'incluir_sem_compras')::boolean, false);
  v_excluir_optout := COALESCE((filtros->>'excluir_optout')::boolean, true);

  v_has_advec := 'advec' = ANY(v_segmentos);
  v_has_igreja_cnpj := 'igreja_cnpj' = ANY(v_segmentos);
  v_has_igreja_cpf := 'igreja_cpf' = ANY(v_segmentos);
  v_has_ecommerce := 'ecommerce' = ANY(v_segmentos);
  v_has_licenciado := 'licenciado_revista' = ANY(v_segmentos);
  v_has_pessoa_fisica := 'pessoa_fisica' = ANY(v_segmentos);
  v_has_revendedor := 'revendedor' = ANY(v_segmentos);
  v_has_lojista := 'lojista' = ANY(v_segmentos);
  v_has_representante := 'representante' = ANY(v_segmentos);

  RETURN QUERY
  SELECT v.telefone, v.nome, v.email, v.cliente_id
  FROM public.whatsapp_contatos_360 v
  WHERE
    (
      array_length(v_segmentos, 1) IS NULL
      OR (
        v_logica = 'or' AND (
          (v_has_advec AND v.is_advec)
          OR (v_has_igreja_cnpj AND v.is_igreja_cnpj)
          OR (v_has_igreja_cpf AND v.is_igreja_cpf)
          OR (v_has_ecommerce AND v.is_ecommerce)
          OR (v_has_licenciado AND v.is_licenciado_revista)
          OR (v_has_pessoa_fisica AND v.is_pessoa_fisica)
          OR (v_has_revendedor AND v.is_revendedor)
          OR (v_has_lojista AND v.is_lojista)
          OR (v_has_representante AND v.is_representante)
        )
      )
      OR (
        v_logica = 'and' AND
          (NOT v_has_advec OR v.is_advec) AND
          (NOT v_has_igreja_cnpj OR v.is_igreja_cnpj) AND
          (NOT v_has_igreja_cpf OR v.is_igreja_cpf) AND
          (NOT v_has_ecommerce OR v.is_ecommerce) AND
          (NOT v_has_licenciado OR v.is_licenciado_revista) AND
          (NOT v_has_pessoa_fisica OR v.is_pessoa_fisica) AND
          (NOT v_has_revendedor OR v.is_revendedor) AND
          (NOT v_has_lojista OR v.is_lojista) AND
          (NOT v_has_representante OR v.is_representante)
      )
    )
    AND (
      v_rec_tipo = 'qualquer'
      OR (
        v_rec_tipo = 'sem_comprar_ha' AND (
          v.dias_sem_comprar >= v_rec_dias
          OR (v_incluir_sem_compras AND v.dias_sem_comprar IS NULL)
        )
      )
      OR (
        v_rec_tipo = 'comprou_nos_ultimos' AND v.dias_sem_comprar IS NOT NULL AND v.dias_sem_comprar <= v_rec_dias
      )
    )
    AND (NOT v_excluir_optout OR NOT v.tem_optout)
  ORDER BY v.ultima_compra_em DESC NULLS LAST
  LIMIT limite;
END;
$function$;
