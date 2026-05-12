CREATE OR REPLACE FUNCTION public.encaminhar_conversa_para_vendedor(
  _vendedor_id uuid,
  _conversa_id uuid DEFAULT NULL,
  _telefone text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cliente_id uuid;
  _resolved_conversa uuid := _conversa_id;
  _phone_norm text;
BEGIN
  IF NOT (
    public.has_role(_uid, 'admin'::app_role)
    OR public.has_role(_uid, 'superadmin'::app_role)
    OR public.has_role(_uid, 'gerente_ebd'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para encaminhar conversas';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.vendedores WHERE id = _vendedor_id) THEN
    RAISE EXCEPTION 'Vendedor não encontrado';
  END IF;

  -- Se não veio conversa_id, tenta resolver/criar pelo telefone
  IF _resolved_conversa IS NULL THEN
    IF _telefone IS NULL OR length(regexp_replace(_telefone, '\D', '', 'g')) = 0 THEN
      RAISE EXCEPTION 'É necessário informar conversa_id ou telefone';
    END IF;

    _phone_norm := regexp_replace(_telefone, '\D', '', 'g');
    IF length(_phone_norm) >= 12 AND left(_phone_norm, 2) = '55' THEN
      _phone_norm := substring(_phone_norm from 3);
    END IF;

    -- Procura conversa existente por qualquer variante simples
    SELECT id INTO _resolved_conversa
      FROM public.agente_ia_conversas
     WHERE regexp_replace(telefone, '\D', '', 'g') IN (
             _phone_norm,
             '55' || _phone_norm
           )
     ORDER BY ultima_mensagem_em DESC NULLS LAST
     LIMIT 1;

    IF _resolved_conversa IS NULL THEN
      INSERT INTO public.agente_ia_conversas (telefone, status, agente_pausado, ultima_mensagem_em)
      VALUES (_phone_norm, 'pausada_humano', true, now())
      RETURNING id INTO _resolved_conversa;
    END IF;
  END IF;

  UPDATE public.agente_ia_conversas
     SET vendedor_atribuido_id = _vendedor_id,
         atribuida_em = now(),
         atribuida_por = _uid,
         agente_pausado = true,
         status = 'pausada_humano',
         motivo_pausa = COALESCE(motivo_pausa, 'encaminhada_vendedor')
   WHERE id = _resolved_conversa
   RETURNING cliente_id INTO _cliente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa não encontrada';
  END IF;

  INSERT INTO public.agente_ia_escalations (
    conversa_id, cliente_id, vendedor_alvo_id, motivo, prioridade, status, detalhes
  ) VALUES (
    _resolved_conversa, _cliente_id, _vendedor_id, 'cliente_solicitou_humano', 'normal', 'em_atendimento',
    'Encaminhada manualmente pelo gerente'
  );

  RETURN jsonb_build_object('sucesso', true, 'conversa_id', _resolved_conversa, 'vendedor_id', _vendedor_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.encaminhar_conversa_para_vendedor(uuid, uuid, text) TO authenticated;