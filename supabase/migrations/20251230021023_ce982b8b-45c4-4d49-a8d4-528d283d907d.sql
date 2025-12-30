-- Permitir que superintendentes EBD gerenciem escalas do próprio cliente
-- Ajusta a policy existente (churches) para também aceitar ebd_clientes.superintendente_user_id

ALTER POLICY "Church owners can manage their escalas"
ON public.ebd_escalas
USING (
  church_id IN (
    SELECT churches.id FROM public.churches WHERE churches.user_id = auth.uid()
  )
  OR
  church_id IN (
    SELECT ebd_clientes.id
    FROM public.ebd_clientes
    WHERE ebd_clientes.superintendente_user_id = auth.uid()
      AND ebd_clientes.status_ativacao_ebd = true
  )
)
WITH CHECK (
  church_id IN (
    SELECT churches.id FROM public.churches WHERE churches.user_id = auth.uid()
  )
  OR
  church_id IN (
    SELECT ebd_clientes.id
    FROM public.ebd_clientes
    WHERE ebd_clientes.superintendente_user_id = auth.uid()
      AND ebd_clientes.status_ativacao_ebd = true
  )
);

-- (Opcional) permitir gerente_ebd também
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ebd_escalas'
      AND policyname = 'Gerente EBD can manage escalas'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Gerente EBD can manage escalas"
      ON public.ebd_escalas
      AS RESTRICTIVE
      FOR ALL
      USING (public.has_role(auth.uid(), 'gerente_ebd'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'gerente_ebd'::public.app_role));
    $pol$;
  END IF;
END$$;