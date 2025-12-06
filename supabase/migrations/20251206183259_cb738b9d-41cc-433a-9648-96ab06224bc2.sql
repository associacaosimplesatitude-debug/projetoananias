-- Add new configuration columns to ebd_turmas
ALTER TABLE public.ebd_turmas 
ADD COLUMN IF NOT EXISTS permite_lancamento_ofertas boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS permite_lancamento_revistas boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS permite_lancamento_biblias boolean NOT NULL DEFAULT true;