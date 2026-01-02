ALTER TABLE public.ebd_leads_reativacao
ADD COLUMN IF NOT EXISTS created_via text;

CREATE INDEX IF NOT EXISTS idx_ebd_leads_reativacao_created_via
ON public.ebd_leads_reativacao (created_via);
