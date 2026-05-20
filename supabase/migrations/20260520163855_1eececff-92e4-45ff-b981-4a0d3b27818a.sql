
-- 1. Add new columns to whatsapp_campanhas
ALTER TABLE public.whatsapp_campanhas
  ADD COLUMN IF NOT EXISTS publico_id uuid NULL REFERENCES public.whatsapp_publicos(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS filtros_publico_snapshot jsonb NULL,
  ADD COLUMN IF NOT EXISTS template_variaveis jsonb NULL,
  ADD COLUMN IF NOT EXISTS cabecalho_midia_url text NULL,
  ADD COLUMN IF NOT EXISTS agendada_para timestamptz NULL,
  ADD COLUMN IF NOT EXISTS iniciada_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS finalizada_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS pausada_em timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_campanhas_status ON public.whatsapp_campanhas(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campanhas_agendada_para ON public.whatsapp_campanhas(agendada_para) WHERE status = 'agendada';

-- 2. Allow extended status values (drop old constraint if any, recreate)
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.whatsapp_campanhas'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%status%' LOOP
    EXECUTE format('ALTER TABLE public.whatsapp_campanhas DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.whatsapp_campanhas
  ADD CONSTRAINT whatsapp_campanhas_status_check CHECK (status IN (
    'rascunho','agendada','materializando','pronta','processando','pausada',
    'concluida','cancelada','erro',
    -- legacy values kept for backwards compatibility
    'enviando','enviada','ativa'
  ));

-- 3. Error tracking on recipients
ALTER TABLE public.whatsapp_campanha_destinatarios
  ADD COLUMN IF NOT EXISTS erro_codigo text NULL,
  ADD COLUMN IF NOT EXISTS erro_mensagem text NULL;

-- 4. Default quiet hours setting (value column is text → store JSON as text)
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'whatsapp_quiet_hours',
  '{"inicio_hora": 8, "fim_hora": 20, "dias_semana": [1,2,3,4,5,6], "timezone": "America/Sao_Paulo"}',
  'Janela permitida para envios de WhatsApp em massa (ISO: 1=Seg ... 7=Dom)'
) ON CONFLICT (key) DO NOTHING;

-- 5. Quiet hours function
CREATE OR REPLACE FUNCTION public.whatsapp_dentro_quiet_hours()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text;
  v jsonb;
  v_tz text;
  v_inicio int;
  v_fim int;
  v_dias int[];
  v_now timestamptz;
  v_local timestamp;
  v_hora int;
  v_dow int;
BEGIN
  SELECT value INTO v_raw FROM public.system_settings WHERE key = 'whatsapp_quiet_hours';
  IF v_raw IS NULL OR length(trim(v_raw)) = 0 THEN
    RETURN true;
  END IF;
  BEGIN
    v := v_raw::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN true;
  END;
  v_tz := COALESCE(v->>'timezone', 'America/Sao_Paulo');
  v_inicio := COALESCE((v->>'inicio_hora')::int, 8);
  v_fim := COALESCE((v->>'fim_hora')::int, 20);
  SELECT COALESCE(array_agg((d)::int), ARRAY[1,2,3,4,5,6])
    INTO v_dias
    FROM jsonb_array_elements_text(COALESCE(v->'dias_semana', '[1,2,3,4,5,6]'::jsonb)) d;

  v_now := now();
  v_local := v_now AT TIME ZONE v_tz;
  v_hora := EXTRACT(HOUR FROM v_local)::int;
  -- ISO dow: 1=Mon .. 7=Sun
  v_dow := EXTRACT(ISODOW FROM v_local)::int;

  IF NOT (v_dow = ANY (v_dias)) THEN
    RETURN false;
  END IF;
  IF v_hora < v_inicio OR v_hora >= v_fim THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.whatsapp_dentro_quiet_hours() TO authenticated, anon, service_role;

-- 6. Materialize campaign recipients from a público
CREATE OR REPLACE FUNCTION public.whatsapp_campanha_materializar(p_campanha_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_publico_id uuid;
  v_filtros jsonb;
  v_inserted int := 0;
  v_is_caller_superadmin boolean;
BEGIN
  -- Allow service_role unrestricted; require superadmin for end users
  v_is_caller_superadmin := (
    auth.uid() IS NULL  -- service role / cron
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  );
  IF NOT v_is_caller_superadmin THEN
    RAISE EXCEPTION 'Acesso negado: requer superadmin';
  END IF;

  SELECT publico_id INTO v_publico_id
    FROM public.whatsapp_campanhas
    WHERE id = p_campanha_id;

  IF v_publico_id IS NULL THEN
    RAISE EXCEPTION 'Campanha % não possui público vinculado', p_campanha_id;
  END IF;

  SELECT filtros INTO v_filtros
    FROM public.whatsapp_publicos
    WHERE id = v_publico_id;

  IF v_filtros IS NULL THEN
    RAISE EXCEPTION 'Público % não encontrado ou sem filtros', v_publico_id;
  END IF;

  -- Snapshot filters
  UPDATE public.whatsapp_campanhas
    SET filtros_publico_snapshot = v_filtros,
        filtros_publico = COALESCE(filtros_publico, v_filtros)
    WHERE id = p_campanha_id;

  -- Insert dedup recipients from contatos_360 matching público filters
  -- Exclude opt-outs (security at send time)
  WITH base AS (
    SELECT * FROM public.whatsapp_publico_materializar(v_filtros, 1000000)
  ),
  dedup AS (
    SELECT DISTINCT ON (telefone)
      telefone, nome, email
    FROM base
    WHERE telefone IS NOT NULL AND length(telefone) >= 10
      AND NOT EXISTS (
        SELECT 1 FROM public.whatsapp_optouts o WHERE o.telefone = base.telefone
      )
  ),
  ins AS (
    INSERT INTO public.whatsapp_campanha_destinatarios
      (campanha_id, telefone, nome, email, status_envio)
    SELECT p_campanha_id, telefone, nome, email, 'pendente'
    FROM dedup
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  UPDATE public.whatsapp_campanhas
    SET total_publico = v_inserted,
        status = CASE WHEN v_inserted > 0 THEN 'pronta' ELSE 'erro' END
    WHERE id = p_campanha_id;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.whatsapp_campanha_materializar(uuid) TO authenticated, service_role;
