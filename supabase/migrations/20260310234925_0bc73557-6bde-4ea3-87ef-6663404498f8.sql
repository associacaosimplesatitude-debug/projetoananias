
ALTER TABLE public.revistas_digitais 
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS autor text,
  ADD COLUMN IF NOT EXISTS ano_publicacao integer DEFAULT EXTRACT(YEAR FROM now())::integer,
  ADD COLUMN IF NOT EXISTS status_publicacao text DEFAULT 'rascunho';
