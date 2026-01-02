-- Adicionar colunas para tracking de leads na tabela ebd_leads_reativacao
ALTER TABLE public.ebd_leads_reativacao 
ADD COLUMN IF NOT EXISTS como_conheceu TEXT,
ADD COLUMN IF NOT EXISTS origem_lead TEXT DEFAULT 'Landing Page',
ADD COLUMN IF NOT EXISTS tipo_lead TEXT DEFAULT 'Auto Cadastro';