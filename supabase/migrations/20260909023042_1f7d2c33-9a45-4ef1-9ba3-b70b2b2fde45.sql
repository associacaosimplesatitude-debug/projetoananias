CREATE OR REPLACE FUNCTION public.audit_vendedor_propostas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_old->v_key IS DISTINCT FROM v_new->v_key THEN
        v_changed := v_changed || jsonb_build_object(v_key, v_new->v_key);
        v_old_changed := v_old_changed || jsonb_build_object(v_key, v_old->v_key);
      END IF;
    END LOOP;

    IF v_changed = '{}'::jsonb
       OR (v_changed - 'updated_at' - 'bling_synced_at' - 'bling_status' - 'bling_status_id') = '{}'::jsonb THEN
      RETURN NEW;
    END IF;

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
$function$;

DELETE FROM public.vendedor_propostas_audit
WHERE action = 'UPDATE'
  AND new_data IS NOT NULL
  AND (new_data - 'updated_at' - 'bling_synced_at' - 'bling_status' - 'bling_status_id') = '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_vp_audit_created_at ON public.vendedor_propostas_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vp_audit_proposta ON public.vendedor_propostas_audit (proposta_id);
CREATE INDEX IF NOT EXISTS idx_vp_bling_synced_at ON public.vendedor_propostas (bling_synced_at NULLS FIRST) WHERE bling_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ebd_alunos_active ON public.ebd_alunos (is_active);
CREATE INDEX IF NOT EXISTS idx_ebd_professores_active ON public.ebd_professores (is_active);