-- Add codigo_bling column to store the SKU/code used in NFe items
ALTER TABLE public.royalties_livros 
ADD COLUMN IF NOT EXISTS codigo_bling TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_royalties_livros_codigo_bling 
ON public.royalties_livros(codigo_bling) WHERE codigo_bling IS NOT NULL;

COMMENT ON COLUMN public.royalties_livros.codigo_bling IS 'Código/SKU do produto no Bling (usado para matching em NFes)';