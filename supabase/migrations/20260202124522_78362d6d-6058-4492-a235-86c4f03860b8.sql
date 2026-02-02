-- Política para autor ver seus próprios descontos por categoria
CREATE POLICY "Autor view own descontos" 
ON public.royalties_descontos_categoria_autor 
FOR SELECT 
TO authenticated 
USING (
  autor_id = public.get_autor_id_by_user(auth.uid())
);