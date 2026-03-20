CREATE POLICY "admin_delete_participantes" ON public.sorteio_participantes
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_delete_ganhadores" ON public.sorteio_ganhadores
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));