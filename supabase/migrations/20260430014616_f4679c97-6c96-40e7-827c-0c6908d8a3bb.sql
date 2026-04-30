
-- 1) Colunas de áudio em revista_licoes
ALTER TABLE public.revista_licoes
  ADD COLUMN IF NOT EXISTS transcricao_audio TEXT NULL,
  ADD COLUMN IF NOT EXISTS audio_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS audio_voz TEXT NULL,
  ADD COLUMN IF NOT EXISTS audio_modelo TEXT NULL DEFAULT 'tts-1-hd',
  ADD COLUMN IF NOT EXISTS transcricao_gerada_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS audio_gerado_em TIMESTAMPTZ NULL;

-- 2) Bucket público licoes-audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('licoes-audio', 'licoes-audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3) Policies do bucket: leitura pública, escrita só service_role (políticas para anon/authenticated NÃO criadas = bloqueado)
DROP POLICY IF EXISTS "Public read licoes-audio" ON storage.objects;
CREATE POLICY "Public read licoes-audio"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'licoes-audio');
