ALTER TABLE public.revistas_digitais 
ADD COLUMN IF NOT EXISTS tipo_conteudo text NOT NULL DEFAULT 'revista',
ADD COLUMN IF NOT EXISTS leitura_continua boolean NOT NULL DEFAULT false;