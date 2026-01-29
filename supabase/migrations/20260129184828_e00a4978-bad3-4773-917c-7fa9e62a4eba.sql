-- Add bling_produto_id column to royalties_livros
ALTER TABLE public.royalties_livros
ADD COLUMN IF NOT EXISTS bling_produto_id BIGINT DEFAULT NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_royalties_livros_bling_id 
ON public.royalties_livros(bling_produto_id);

-- Add comment for documentation
COMMENT ON COLUMN public.royalties_livros.bling_produto_id 
IS 'ID do produto correspondente no Bling ERP';