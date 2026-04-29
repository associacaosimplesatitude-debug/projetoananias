CREATE TABLE public.google_ads_conversion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at timestamptz NOT NULL DEFAULT now(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  canal text NOT NULL,
  enviados integer NOT NULL DEFAULT 0,
  aceitos integer NOT NULL DEFAULT 0,
  erros jsonb NOT NULL DEFAULT '[]'::jsonb,
  trigger text NOT NULL,
  raw_response jsonb
);

ALTER TABLE public.google_ads_conversion_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver logs de conversão Google Ads"
ON public.google_ads_conversion_logs
FOR SELECT
TO authenticated
USING (public.is_admin_geral(auth.uid()));

CREATE INDEX idx_google_ads_conversion_logs_executed_at
  ON public.google_ads_conversion_logs (executed_at DESC);