-- Vendedores: ver igrejas atribuídas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='Vendedores can view assigned churches' AND tablename='churches'
  ) THEN
    CREATE POLICY "Vendedores can view assigned churches"
    ON public.churches
    FOR SELECT
    TO authenticated
    USING (vendedor_id = public.get_vendedor_id_by_email(public.get_auth_email()));
  END IF;
END $$;

-- Vendedores: ver assinaturas dos clientes atribuídos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='Vendedores can select assinaturas of assigned churches' AND tablename='assinaturas'
  ) THEN
    CREATE POLICY "Vendedores can select assinaturas of assigned churches"
    ON public.assinaturas
    FOR SELECT
    TO authenticated
    USING (
      cliente_id IN (
        SELECT c.id
        FROM public.churches c
        WHERE c.vendedor_id = public.get_vendedor_id_by_email(public.get_auth_email())
      )
    );
  END IF;
END $$;
