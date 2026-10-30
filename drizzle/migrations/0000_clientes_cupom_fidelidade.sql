CREATE TABLE public.clientes_cupom_fidelidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf text NOT NULL,
  nome text,
  telefone text,
  email text,
  coupon_code text NOT NULL,
  expires_at timestamptz,
  usado boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  usado_em timestamptz,
  whatsapp_enviado_em timestamptz
);
CREATE UNIQUE INDEX clientes_cupom_fidelidade_cpf_key ON public.clientes_cupom_fidelidade (cpf);
GRANT SELECT ON public.clientes_cupom_fidelidade TO authenticated;
GRANT ALL ON public.clientes_cupom_fidelidade TO service_role;
ALTER TABLE public.clientes_cupom_fidelidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem cupons de fidelidade" ON public.clientes_cupom_fidelidade
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'superadmin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente_ebd'));

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

  -- Público especial: clientes com cupom de fidelidade válido (Central Gospel Store)
  IF 'cupom_fidelidade' = ANY(v_segmentos) THEN
    RETURN QUERY
    SELECT DISTINCT ON (c.telefone) c.telefone, c.nome, c.email, NULL::uuid
    FROM public.clientes_cupom_fidelidade c
    WHERE c.usado = false
      AND c.expires_at >= now()
      AND c.telefone IS NOT NULL AND c.telefone <> ''
      AND (NOT v_excluir_optout OR NOT EXISTS (
        SELECT 1 FROM public.whatsapp_optouts o WHERE o.telefone = c.telefone))
    ORDER BY c.telefone, c.criado_em DESC
    LIMIT limite;
    RETURN;
  END IF;

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