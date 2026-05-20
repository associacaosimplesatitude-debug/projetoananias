-- Tabela whatsapp_publicos
CREATE TABLE public.whatsapp_publicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text NULL,
  filtros jsonb NOT NULL,
  total_calculado int NULL,
  calculado_em timestamptz NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.whatsapp_publicos.filtros IS
'JSONB schema:
{
  "segmentos": ["advec","igreja_cnpj","igreja_cpf","ecommerce","licenciado_revista"],
  "segmentos_logica": "or" | "and",
  "recencia_tipo": "qualquer" | "sem_comprar_ha" | "comprou_nos_ultimos",
  "recencia_dias": 60,
  "incluir_sem_compras": true,
  "excluir_optout": true
}';

ALTER TABLE public.whatsapp_publicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin select publicos" ON public.whatsapp_publicos
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin insert publicos" ON public.whatsapp_publicos
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'superadmin') AND created_by = auth.uid());

CREATE POLICY "Superadmin update publicos" ON public.whatsapp_publicos
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin delete publicos" ON public.whatsapp_publicos
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));

-- Trigger updated_at
CREATE TRIGGER trg_whatsapp_publicos_updated_at
BEFORE UPDATE ON public.whatsapp_publicos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Materializador (interno) — retorna linhas filtradas da view
CREATE OR REPLACE FUNCTION public.whatsapp_publico_materializar(filtros jsonb, limite int DEFAULT NULL)
RETURNS TABLE(telefone text, nome text, email text, cliente_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
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

  RETURN QUERY
  SELECT v.telefone, v.nome, v.email, v.cliente_id
  FROM public.whatsapp_contatos_360 v
  WHERE
    -- Segmentos
    (
      array_length(v_segmentos, 1) IS NULL
      OR (
        v_logica = 'or' AND (
          (v_has_advec AND v.is_advec)
          OR (v_has_igreja_cnpj AND v.is_igreja_cnpj)
          OR (v_has_igreja_cpf AND v.is_igreja_cpf)
          OR (v_has_ecommerce AND v.is_ecommerce)
          OR (v_has_licenciado AND v.is_licenciado_revista)
        )
      )
      OR (
        v_logica = 'and' AND
          (NOT v_has_advec OR v.is_advec) AND
          (NOT v_has_igreja_cnpj OR v.is_igreja_cnpj) AND
          (NOT v_has_igreja_cpf OR v.is_igreja_cpf) AND
          (NOT v_has_ecommerce OR v.is_ecommerce) AND
          (NOT v_has_licenciado OR v.is_licenciado_revista)
      )
    )
    -- Recência
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
    -- Optout
    AND (NOT v_excluir_optout OR NOT v.tem_optout)
  ORDER BY v.ultima_compra_em DESC NULLS LAST
  LIMIT limite;
END;
$$;

-- Contador
CREATE OR REPLACE FUNCTION public.whatsapp_publico_contar(filtros jsonb)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'Acesso negado: requer superadmin';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.whatsapp_publico_materializar(filtros, NULL);

  RETURN v_total;
END;
$$;

-- Recalcular
CREATE OR REPLACE FUNCTION public.whatsapp_publico_recalcular(publico_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_filtros jsonb;
  v_total int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'Acesso negado: requer superadmin';
  END IF;

  SELECT filtros INTO v_filtros FROM public.whatsapp_publicos WHERE id = publico_id;
  IF v_filtros IS NULL THEN
    RAISE EXCEPTION 'Público % não encontrado', publico_id;
  END IF;

  v_total := public.whatsapp_publico_contar(v_filtros);

  UPDATE public.whatsapp_publicos
  SET total_calculado = v_total, calculado_em = now()
  WHERE id = publico_id;

  RETURN v_total;
END;
$$;