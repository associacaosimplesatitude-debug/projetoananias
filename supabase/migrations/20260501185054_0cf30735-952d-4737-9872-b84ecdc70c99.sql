ALTER TABLE public.ebd_clientes 
  ADD COLUMN IF NOT EXISTS senha_provisoria_enviada_em timestamptz,
  ADD COLUMN IF NOT EXISTS deve_trocar_senha boolean DEFAULT false;

UPDATE public.ebd_clientes 
SET deve_trocar_senha = true 
WHERE senha_temporaria IS NOT NULL AND senha_temporaria != '';