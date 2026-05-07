
DROP POLICY IF EXISTS "Vendedores podem inserir contatos para seus clientes" ON public.ebd_retencao_contatos;
DROP POLICY IF EXISTS "Vendedores podem ver seus contatos" ON public.ebd_retencao_contatos;

CREATE POLICY "Vendedores podem inserir contatos para seus clientes"
ON public.ebd_retencao_contatos
FOR INSERT
TO authenticated
WITH CHECK (
  vendedor_id IS NULL
  OR vendedor_id = public.get_vendedor_id_by_email(
    (SELECT (auth.jwt() ->> 'email'))
  )
);

CREATE POLICY "Vendedores podem ver seus contatos"
ON public.ebd_retencao_contatos
FOR SELECT
TO authenticated
USING (
  vendedor_id = public.get_vendedor_id_by_email(
    (SELECT (auth.jwt() ->> 'email'))
  )
);
