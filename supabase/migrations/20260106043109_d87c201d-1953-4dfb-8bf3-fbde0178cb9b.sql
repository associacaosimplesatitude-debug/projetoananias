-- Adicionar coluna peso_bruto na tabela ebd_revistas
ALTER TABLE public.ebd_revistas 
ADD COLUMN IF NOT EXISTS peso_bruto NUMERIC DEFAULT 0;

-- Comentário para documentação
COMMENT ON COLUMN public.ebd_revistas.peso_bruto IS 'Peso bruto do produto em kg, sincronizado do Bling';