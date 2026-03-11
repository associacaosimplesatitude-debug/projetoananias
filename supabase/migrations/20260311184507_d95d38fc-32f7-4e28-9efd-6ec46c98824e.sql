
-- Add columns to revista_licencas
ALTER TABLE public.revista_licencas 
  ADD COLUMN IF NOT EXISTS revista_aluno_id uuid REFERENCES public.revistas_digitais(id),
  ADD COLUMN IF NOT EXISTS revista_professor_id uuid REFERENCES public.revistas_digitais(id),
  ADD COLUMN IF NOT EXISTS pacote_id uuid REFERENCES public.revista_planos(id),
  ADD COLUMN IF NOT EXISTS chave_pix text,
  ADD COLUMN IF NOT EXISTS link_pagamento text,
  ADD COLUMN IF NOT EXISTS qrcode_url text,
  ADD COLUMN IF NOT EXISTS codigo_pagamento text UNIQUE;

-- Add columns to revista_licenca_alunos
ALTER TABLE public.revista_licenca_alunos
  ADD COLUMN IF NOT EXISTS tipo_revista text DEFAULT 'aluno',
  ADD COLUMN IF NOT EXISTS senha_provisoria text DEFAULT 'mudar123';

-- Anon SELECT on revista_licencas for public payment page (only by codigo_pagamento)
CREATE POLICY "anon_select_by_codigo_pagamento"
  ON public.revista_licencas
  FOR SELECT
  TO anon
  USING (codigo_pagamento IS NOT NULL);

-- Anon INSERT on revista_licenca_alunos for public registration
CREATE POLICY "anon_insert_revista_licenca_alunos"
  ON public.revista_licenca_alunos
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Anon SELECT on ebd_clientes for public page (nome_igreja)
CREATE POLICY "anon_select_ebd_clientes_public"
  ON public.ebd_clientes
  FOR SELECT
  TO anon
  USING (true);

-- Anon SELECT on revistas_digitais for public page
CREATE POLICY "anon_select_revistas_digitais_public"
  ON public.revistas_digitais
  FOR SELECT
  TO anon
  USING (true);

-- Anon upload to comprovantes bucket
INSERT INTO storage.objects (bucket_id, name, owner, metadata)
SELECT 'comprovantes', '.keep', null, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'comprovantes' AND name = '.keep');

CREATE POLICY "anon_upload_comprovantes"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'comprovantes');

CREATE POLICY "anon_select_comprovantes"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'comprovantes');

-- Make comprovantes bucket public for viewing
UPDATE storage.buckets SET public = true WHERE id = 'comprovantes';
