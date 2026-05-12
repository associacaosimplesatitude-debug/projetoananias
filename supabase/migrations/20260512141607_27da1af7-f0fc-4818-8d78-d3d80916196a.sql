
-- 1. Colunas novas em agente_ia_conversas
ALTER TABLE public.agente_ia_conversas
  ADD COLUMN IF NOT EXISTS vendedor_atribuido_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS atribuida_em timestamptz,
  ADD COLUMN IF NOT EXISTS atribuida_por uuid;

CREATE INDEX IF NOT EXISTS idx_agente_ia_conv_vendedor_atribuido
  ON public.agente_ia_conversas (vendedor_atribuido_id)
  WHERE vendedor_atribuido_id IS NOT NULL;

-- 2. RLS: vendedor lê conversas atribuídas
DROP POLICY IF EXISTS "vendedor_le_conversas_atribuidas" ON public.agente_ia_conversas;
CREATE POLICY "vendedor_le_conversas_atribuidas"
  ON public.agente_ia_conversas FOR SELECT
  TO authenticated
  USING (
    vendedor_atribuido_id IS NOT NULL
    AND vendedor_atribuido_id = public.get_vendedor_id_by_email(public.get_auth_email())
  );

-- 3. RLS: vendedor lê mensagens de conversas atribuídas
DROP POLICY IF EXISTS "vendedor_le_mensagens_conversas_atribuidas" ON public.agente_ia_mensagens;
CREATE POLICY "vendedor_le_mensagens_conversas_atribuidas"
  ON public.agente_ia_mensagens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agente_ia_conversas c
      WHERE c.id = agente_ia_mensagens.conversa_id
        AND c.vendedor_atribuido_id IS NOT NULL
        AND c.vendedor_atribuido_id = public.get_vendedor_id_by_email(public.get_auth_email())
    )
  );

-- 4. RLS: vendedor insere mensagens em conversas atribuídas
DROP POLICY IF EXISTS "vendedor_insere_mensagens_conversas_atribuidas" ON public.agente_ia_mensagens;
CREATE POLICY "vendedor_insere_mensagens_conversas_atribuidas"
  ON public.agente_ia_mensagens FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agente_ia_conversas c
      WHERE c.id = agente_ia_mensagens.conversa_id
        AND c.vendedor_atribuido_id IS NOT NULL
        AND c.vendedor_atribuido_id = public.get_vendedor_id_by_email(public.get_auth_email())
    )
  );

-- 5. RPC: encaminhar conversa para vendedor
CREATE OR REPLACE FUNCTION public.encaminhar_conversa_para_vendedor(
  _conversa_id uuid,
  _vendedor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cliente_id uuid;
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

  UPDATE public.agente_ia_conversas
     SET vendedor_atribuido_id = _vendedor_id,
         atribuida_em = now(),
         atribuida_por = _uid,
         agente_pausado = true,
         status = 'pausada_humano',
         motivo_pausa = COALESCE(motivo_pausa, 'encaminhada_vendedor')
   WHERE id = _conversa_id
   RETURNING cliente_id INTO _cliente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa não encontrada';
  END IF;

  INSERT INTO public.agente_ia_escalations (
    conversa_id, cliente_id, vendedor_alvo_id, motivo, prioridade, status, detalhes
  ) VALUES (
    _conversa_id, _cliente_id, _vendedor_id, 'cliente_solicitou_humano', 'normal', 'em_atendimento',
    'Encaminhada manualmente pelo gerente'
  );

  RETURN jsonb_build_object('sucesso', true, 'conversa_id', _conversa_id, 'vendedor_id', _vendedor_id);
END;
$$;

-- 6. RPC: devolver conversa para o agente
CREATE OR REPLACE FUNCTION public.devolver_conversa_para_agente(
  _conversa_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF NOT (
    public.has_role(_uid, 'admin'::app_role)
    OR public.has_role(_uid, 'superadmin'::app_role)
    OR public.has_role(_uid, 'gerente_ebd'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para devolver conversas';
  END IF;

  UPDATE public.agente_ia_conversas
     SET vendedor_atribuido_id = NULL,
         atribuida_em = NULL,
         atribuida_por = NULL,
         agente_pausado = false,
         status = 'ativa',
         motivo_pausa = NULL
   WHERE id = _conversa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa não encontrada';
  END IF;

  UPDATE public.agente_ia_escalations
     SET status = 'resolvida',
         resolvida_em = now(),
         resolvida_por = NULL,
         resolucao = 'Devolvida ao agente IA'
   WHERE conversa_id = _conversa_id
     AND status IN ('aberta','em_atendimento');

  RETURN jsonb_build_object('sucesso', true, 'conversa_id', _conversa_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.encaminhar_conversa_para_vendedor(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.devolver_conversa_para_agente(uuid) TO authenticated;
