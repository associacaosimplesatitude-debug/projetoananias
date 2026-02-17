ALTER TABLE funil_posv_tracking
ADD COLUMN IF NOT EXISTS email_acesso TEXT,
ADD COLUMN IF NOT EXISTS senha_temp TEXT;