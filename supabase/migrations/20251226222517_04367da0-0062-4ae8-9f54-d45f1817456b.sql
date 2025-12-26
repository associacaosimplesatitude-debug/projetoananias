-- Criar cron job para sincronizar pedidos de marketplaces automaticamente a cada 30 minutos
-- A extensão pg_cron já está habilitada

-- Primeiro, remover jobs existentes se houver
SELECT cron.unschedule('sync-marketplace-orders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-marketplace-orders'
);

-- Criar o job de sincronização automática - a cada 30 minutos
SELECT cron.schedule(
  'sync-marketplace-orders',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/bling-sync-marketplace-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jY3lydmZudmpuZ2Z5ZnZnbnd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjMzNzQsImV4cCI6MjA3OTAzOTM3NH0.X7KFK1yGyeD0wqHQXCCLDqh9YBixDXYl9qNzwY6LXCI'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Criar job para sincronizar pedidos da Central Gospel (Shopify) a cada 30 minutos
SELECT cron.unschedule('sync-cg-shopify-orders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-cg-shopify-orders'
);

SELECT cron.schedule(
  'sync-cg-shopify-orders',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/cg-shopify-sync-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jY3lydmZudmpuZ2Z5ZnZnbnd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjMzNzQsImV4cCI6MjA3OTAzOTM3NH0.X7KFK1yGyeD0wqHQXCCLDqh9YBixDXYl9qNzwY6LXCI'
    ),
    body := '{"financial_status": "paid"}'::jsonb
  ) AS request_id;
  $$
);

-- Criar job para sincronizar pedidos EBD Shopify a cada 30 minutos
SELECT cron.unschedule('sync-ebd-shopify-orders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-ebd-shopify-orders'
);

SELECT cron.schedule(
  'sync-ebd-shopify-orders',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/ebd-shopify-sync-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jY3lydmZudmpuZ2Z5ZnZnbnd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjMzNzQsImV4cCI6MjA3OTAzOTM3NH0.X7KFK1yGyeD0wqHQXCCLDqh9YBixDXYl9qNzwY6LXCI'
    ),
    body := '{"financial_status": "paid"}'::jsonb
  ) AS request_id;
  $$
);