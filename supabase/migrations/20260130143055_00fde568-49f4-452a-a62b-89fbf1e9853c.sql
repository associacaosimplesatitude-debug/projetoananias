-- Add index on slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_royalties_affiliate_links_slug 
  ON public.royalties_affiliate_links(slug);

-- Add index on livro_id for faster joins
CREATE INDEX IF NOT EXISTS idx_royalties_affiliate_links_livro_id 
  ON public.royalties_affiliate_links(livro_id);

-- Add index on autor_id for faster joins
CREATE INDEX IF NOT EXISTS idx_royalties_affiliate_links_autor_id 
  ON public.royalties_affiliate_links(autor_id);