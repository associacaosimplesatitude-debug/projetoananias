CREATE TABLE IF NOT EXISTS public.agente_ia_guardrail_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid REFERENCES public.agente_ia_conversas(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  detalhes jsonb,
  texto_bloqueado text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guardrail_alerts_conversa ON public.agente_ia_guardrail_alerts(conversa_id);
CREATE INDEX IF NOT EXISTS idx_guardrail_alerts_created ON public.agente_ia_guardrail_alerts(created_at DESC);

ALTER TABLE public.agente_ia_guardrail_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='agente_ia_guardrail_alerts' AND policyname='Admins can read guardrail alerts'
  ) THEN
    CREATE POLICY "Admins can read guardrail alerts"
      ON public.agente_ia_guardrail_alerts FOR SELECT
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;