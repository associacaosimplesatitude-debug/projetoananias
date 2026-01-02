ALTER TABLE public.ebd_leads_reativacao
ADD COLUMN IF NOT EXISTS status_kanban text DEFAULT 'Cadastrou';

CREATE INDEX IF NOT EXISTS idx_ebd_leads_reativacao_status_kanban
ON public.ebd_leads_reativacao (status_kanban);