-- Adicionar campos extras na tabela royalties_livros
ALTER TABLE public.royalties_livros
ADD COLUMN IF NOT EXISTS subtitulo TEXT,
ADD COLUMN IF NOT EXISTS especificacoes JSONB,
ADD COLUMN IF NOT EXISTS diferenciais TEXT[];

-- Adicionar campos extras na tabela royalties_autores
ALTER TABLE public.royalties_autores
ADD COLUMN IF NOT EXISTS foto_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Criar índice para performance nas buscas
CREATE INDEX IF NOT EXISTS idx_royalties_livros_subtitulo ON public.royalties_livros(subtitulo) WHERE subtitulo IS NOT NULL;