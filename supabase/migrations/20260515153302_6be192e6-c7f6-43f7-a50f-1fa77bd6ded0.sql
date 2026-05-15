-- Tabela de log de envios do resumo diário
CREATE TABLE public.resumo_diario_envios_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_ref date NOT NULL,
  destinatario_id uuid REFERENCES public.resumo_diario_destinatarios(id) ON DELETE SET NULL,
  telefone text NOT NULL,
  whatsapp_message_id text,
  status text NOT NULL CHECK (status IN ('sucesso', 'falha')),
  erro_mensagem text,
  payload_enviado jsonb,
  disparo_tipo text NOT NULL CHECK (disparo_tipo IN ('manual', 'cron')),
  disparado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_resumo_envios_log_data ON public.resumo_diario_envios_log (data_ref DESC, created_at DESC);
CREATE INDEX idx_resumo_envios_log_dest_dataref ON public.resumo_diario_envios_log (destinatario_id, data_ref, disparo_tipo);

ALTER TABLE public.resumo_diario_envios_log ENABLE ROW LEVEL SECURITY;

-- Apenas admin pode ler
CREATE POLICY "admins_select_resumo_envios_log"
ON public.resumo_diario_envios_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- INSERT bloqueado para clientes; somente service role (que bypassa RLS) grava
CREATE POLICY "no_insert_resumo_envios_log"
ON public.resumo_diario_envios_log
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Cron: 21h UTC = 18h BRT diariamente (Brasil sem DST desde 2019)
SELECT cron.unschedule('cron-enviar-resumo-diario') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cron-enviar-resumo-diario'
);

SELECT cron.schedule(
  'cron-enviar-resumo-diario',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/enviar-resumo-diario-whatsapp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jY3lydmZudmpuZ2Z5ZnZnbnd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjMzNzQsImV4cCI6MjA3OTAzOTM3NH0.X7KFK1yGyeD0wqHQXCCLDqh9YBixDXYl9qNzwY6LXCI',
      'x-disparo-tipo', 'cron'
    ),
    body := jsonb_build_object('disparo_tipo', 'cron')
  ) AS request_id;
  $$
);