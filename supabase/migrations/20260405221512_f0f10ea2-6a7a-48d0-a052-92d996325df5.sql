ALTER TABLE public.ebd_revistas 
ADD COLUMN IF NOT EXISTS tipo_conteudo text NOT NULL DEFAULT 'revista',
ADD COLUMN IF NOT EXISTS leitura_continua boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS capitulos_obrigatorio boolean NOT NULL DEFAULT true;