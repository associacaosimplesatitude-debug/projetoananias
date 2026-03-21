
DROP POLICY IF EXISTS "admin_delete_participantes" ON public.sorteio_participantes;

CREATE POLICY "admin_gerente_delete_participantes" ON public.sorteio_participantes
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'gerente_sorteio')
);

-- Also fix DELETE on sorteio_ganhadores for cascade delete
DROP POLICY IF EXISTS "admin_delete_ganhadores" ON public.sorteio_ganhadores;

CREATE POLICY "admin_gerente_delete_ganhadores" ON public.sorteio_ganhadores
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'gerente_sorteio')
);
