-- Add conta_criada field to ebd_leads_reativacao
ALTER TABLE public.ebd_leads_reativacao 
ADD COLUMN IF NOT EXISTS conta_criada boolean DEFAULT false;

-- Add senha_padrao_usada field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS senha_padrao_usada boolean DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_conta_criada ON public.ebd_leads_reativacao(conta_criada);