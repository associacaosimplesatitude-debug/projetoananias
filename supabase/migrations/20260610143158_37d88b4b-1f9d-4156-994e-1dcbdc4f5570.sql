
-- Audit trigger for vendedor_propostas
CREATE OR REPLACE FUNCTION public.audit_vendedor_propostas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_old JSONB;
  v_new JSONB;
  v_changed JSONB := '{}'::jsonb;
  v_old_changed JSONB := '{}'::jsonb;
  v_key TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'CREATE';
    v_new := to_jsonb(NEW);
    INSERT INTO public.vendedor_propostas_audit (proposta_id, action, old_data, new_data, user_id)
    VALUES (NEW.id, v_action, NULL, v_new, auth.uid());
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);

    -- Build diff (only changed top-level fields)
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_old->v_key IS DISTINCT FROM v_new->v_key THEN
        v_changed := v_changed || jsonb_build_object(v_key, v_new->v_key);
        v_old_changed := v_old_changed || jsonb_build_object(v_key, v_old->v_key);
      END IF;
    END LOOP;

    -- Skip noise-only updates (only updated_at changed)
    IF v_changed = '{}'::jsonb OR (v_changed - 'updated_at') = '{}'::jsonb THEN
      RETURN NEW;
    END IF;

    -- Classify action
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'PAGO' THEN
        v_action := 'MARCAR_PAGO';
      ELSIF NEW.status = 'CANCELADA' THEN
        v_action := 'CANCELAR';
      ELSE
        v_action := 'STATUS_CHANGE:' || COALESCE(OLD.status,'NULL') || '->' || COALESCE(NEW.status,'NULL');
      END IF;
    ELSIF OLD.valor_total IS DISTINCT FROM NEW.valor_total THEN
      v_action := 'EDIT_VALOR';
    ELSIF OLD.prazo_faturamento_selecionado IS DISTINCT FROM NEW.prazo_faturamento_selecionado THEN
      v_action := 'EDIT_PRAZO_FATURAMENTO';
    ELSIF OLD.bling_order_id IS DISTINCT FROM NEW.bling_order_id THEN
      v_action := 'BLING_LINK';
    ELSE
      v_action := 'UPDATE';
    END IF;

    INSERT INTO public.vendedor_propostas_audit (proposta_id, action, old_data, new_data, user_id)
    VALUES (NEW.id, v_action, v_old_changed, v_changed, auth.uid());
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.vendedor_propostas_audit (proposta_id, action, old_data, new_data, user_id)
    VALUES (OLD.id, 'DELETE', to_jsonb(OLD), NULL, auth.uid());
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_vendedor_propostas ON public.vendedor_propostas;
CREATE TRIGGER trg_audit_vendedor_propostas
AFTER INSERT OR UPDATE OR DELETE ON public.vendedor_propostas
FOR EACH ROW EXECUTE FUNCTION public.audit_vendedor_propostas();

-- Duplicate detection (BEFORE INSERT — only logs, doesn't block)
CREATE OR REPLACE FUNCTION public.detectar_proposta_duplicada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_dup_ids UUID[];
BEGIN
  IF NEW.cliente_cnpj IS NULL OR NEW.valor_total IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*), ARRAY_AGG(id)
    INTO v_count, v_dup_ids
  FROM public.vendedor_propostas
  WHERE cliente_cnpj = NEW.cliente_cnpj
    AND valor_total = NEW.valor_total
    AND created_at > now() - INTERVAL '10 minutes'
    AND status NOT IN ('CANCELADA');

  IF v_count >= 1 THEN
    -- Log on next INSERT trigger; queue marker in audit
    INSERT INTO public.vendedor_propostas_audit (proposta_id, action, old_data, new_data, user_id)
    VALUES (
      NEW.id,
      'DUPLICATA_SUSPEITA',
      jsonb_build_object('propostas_similares', v_dup_ids, 'janela_minutos', 10),
      jsonb_build_object('cliente_cnpj', NEW.cliente_cnpj, 'valor_total', NEW.valor_total, 'vendedor_id', NEW.vendedor_id),
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detectar_proposta_duplicada ON public.vendedor_propostas;
CREATE TRIGGER trg_detectar_proposta_duplicada
AFTER INSERT ON public.vendedor_propostas
FOR EACH ROW EXECUTE FUNCTION public.detectar_proposta_duplicada();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vpa_proposta_created ON public.vendedor_propostas_audit (proposta_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vpa_user_created ON public.vendedor_propostas_audit (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vpa_action_created ON public.vendedor_propostas_audit (action, created_at DESC);

-- Restrict SELECT to superadmins only
DROP POLICY IF EXISTS "Admins podem ver auditoria de propostas" ON public.vendedor_propostas_audit;
DROP POLICY IF EXISTS "Superadmins podem ver auditoria de propostas" ON public.vendedor_propostas_audit;
CREATE POLICY "Superadmins podem ver auditoria de propostas"
ON public.vendedor_propostas_audit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::app_role));
