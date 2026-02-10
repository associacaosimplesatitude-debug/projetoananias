
ALTER TABLE public.royalties_email_logs 
ADD COLUMN IF NOT EXISTS tipo_envio TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS resend_email_id TEXT;
