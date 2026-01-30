-- Policy: Leitura pública de livros com link de afiliado ativo
CREATE POLICY "Public read livros with active affiliate" 
ON public.royalties_livros
FOR SELECT
USING (
  id IN (
    SELECT livro_id FROM public.royalties_affiliate_links 
    WHERE is_active = true
  )
);

-- Policy: Leitura pública de autores com link de afiliado ativo
CREATE POLICY "Public read autores with active affiliate" 
ON public.royalties_autores
FOR SELECT
USING (
  id IN (
    SELECT autor_id FROM public.royalties_affiliate_links 
    WHERE is_active = true
  )
);