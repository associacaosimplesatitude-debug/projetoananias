ALTER TABLE public.ebd_leads_reativacao
ADD COLUMN IF NOT EXISTS valor_fechamento numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS data_fechamento timestamp with time zone;