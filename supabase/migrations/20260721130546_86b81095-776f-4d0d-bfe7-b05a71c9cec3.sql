ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS cabecalho_media_id TEXT,
  ADD COLUMN IF NOT EXISTS cabecalho_media_id_atualizado_em TIMESTAMPTZ;