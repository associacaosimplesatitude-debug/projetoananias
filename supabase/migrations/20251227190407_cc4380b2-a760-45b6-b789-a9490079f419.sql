-- Allow Gerente EBD and Admin to create/update/delete client records used in order attribution
-- (Fixes RLS violation when creating ebd_clientes from pedidos-online screens)

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.ebd_clientes ENABLE ROW LEVEL SECURITY;

-- Admins full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'ebd_clientes' AND policyname = 'Admins can manage ebd_clientes'
  ) THEN
    CREATE POLICY "Admins can manage ebd_clientes"
    ON public.ebd_clientes
    FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END$$;

-- Gerente EBD full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'ebd_clientes' AND policyname = 'Gerente EBD can manage ebd_clientes'
  ) THEN
    CREATE POLICY "Gerente EBD can manage ebd_clientes"
    ON public.ebd_clientes
    FOR ALL
    USING (has_role(auth.uid(), 'gerente_ebd'::app_role))
    WITH CHECK (has_role(auth.uid(), 'gerente_ebd'::app_role));
  END IF;
END$$;