-- Bucket privado para PDFs de infográficos
INSERT INTO storage.buckets (id, name, public)
VALUES ('infograficos-pdf', 'infograficos-pdf', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: nenhum acesso direto de usuários - apenas service_role (via Edge Function)
-- (não criar policies SELECT/INSERT/UPDATE/DELETE para roles públicos/autenticados)

-- Coluna dedicada para path do PDF privado de infografico
-- (mantém pdf_url existente intacta para compatibilidade)
ALTER TABLE public.revistas_digitais
  ADD COLUMN IF NOT EXISTS pdf_storage_path text;

COMMENT ON COLUMN public.revistas_digitais.pdf_storage_path IS
  'Path do PDF dentro do bucket privado infograficos-pdf. Acessado apenas via signed URL pela edge function download-infografico.';