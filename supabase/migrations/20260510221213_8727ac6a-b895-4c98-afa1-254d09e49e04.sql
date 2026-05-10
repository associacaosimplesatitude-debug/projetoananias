CREATE OR REPLACE FUNCTION public.identificar_pessoa_unificada(p_telefone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_documento text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
    ORDER BY
      (c.vendedor_id IS NOT NULL) DESC,
      (c.email_superintendente IS NOT NULL AND c.email_superintendente <> '') DESC,
      COALESCE(c.updated_at, c.created_at) DESC
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
$function$;