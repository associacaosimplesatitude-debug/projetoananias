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
  v_tokens text[];
  v_resultado jsonb;
BEGIN
  IF v_norm IS NULL OR length(trim(v_norm)) = 0 THEN
    RETURN jsonb_build_object('items','[]'::jsonb,'total_encontrados',0);
  END IF;

  SELECT array_agg(t)
    INTO v_tokens
    FROM unnest(string_to_array(v_norm, ' ')) AS t
    WHERE length(t) >= 2;

  IF v_tokens IS NULL OR array_length(v_tokens,1) = 0 THEN
    RETURN jsonb_build_object('items','[]'::jsonb,'total_encontrados',0);
  END IF;

  WITH fisicas AS (
    SELECT
      'ebd_revistas'::text AS fonte,
      r.id, r.titulo, r.preco_cheio AS preco, r.imagem_url,
      null::text AS sku, r.categoria, r.estoque,
      coalesce(r.estoque,0) > 0 AS disponivel
    FROM ebd_revistas r
    WHERE NOT EXISTS (
      SELECT 1 FROM unnest(v_tokens) AS tok
      WHERE public.normalizar_termo_busca(r.titulo) NOT ILIKE '%' || tok || '%'
    )
    LIMIT p_max
  ),
  digitais AS (
    SELECT
      'revistas_digitais'::text AS fonte,
      rd.id, rd.titulo, null::numeric AS preco, rd.capa_url AS imagem_url,
      null::text AS sku, rd.tipo AS categoria, null::int AS estoque,
      coalesce(rd.ativo,false) AS disponivel
    FROM revistas_digitais rd
    WHERE NOT EXISTS (
      SELECT 1 FROM unnest(v_tokens) AS tok
      WHERE public.normalizar_termo_busca(rd.titulo) NOT ILIKE '%' || tok || '%'
    )
    LIMIT p_max
  ),
  todos AS (
    SELECT * FROM fisicas
    UNION ALL
    SELECT * FROM digitais
  )
  SELECT jsonb_build_object(
    'items', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT * FROM todos LIMIT p_max) t),
      '[]'::jsonb
    ),
    'total_encontrados', (SELECT count(*) FROM todos)
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_catalogo_unificado(text, int) TO anon, authenticated, service_role;