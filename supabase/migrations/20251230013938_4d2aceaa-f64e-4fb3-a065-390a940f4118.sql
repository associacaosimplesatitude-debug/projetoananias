-- Permitir que superintendentes gerenciem professores do seu cliente EBD

-- Garantir RLS habilitado
ALTER TABLE public.ebd_professores ENABLE ROW LEVEL SECURITY;

-- SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ebd_professores'
      AND policyname = 'Superintendentes can select professores'
  ) THEN
    CREATE POLICY "Superintendentes can select professores"
    ON public.ebd_professores
    FOR SELECT
    USING (
      church_id IN (
        SELECT id FROM public.ebd_clientes
        WHERE superintendente_user_id = auth.uid()
          AND status_ativacao_ebd = true
      )
    );
  END IF;
END $$;

-- INSERT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ebd_professores'
      AND policyname = 'Superintendentes can insert professores'
  ) THEN
    CREATE POLICY "Superintendentes can insert professores"
    ON public.ebd_professores
    FOR INSERT
    WITH CHECK (
      church_id IN (
        SELECT id FROM public.ebd_clientes
        WHERE superintendente_user_id = auth.uid()
          AND status_ativacao_ebd = true
      )
    );
  END IF;
END $$;

-- UPDATE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ebd_professores'
      AND policyname = 'Superintendentes can update professores'
  ) THEN
    CREATE POLICY "Superintendentes can update professores"
    ON public.ebd_professores
    FOR UPDATE
    USING (
      church_id IN (
        SELECT id FROM public.ebd_clientes
        WHERE superintendente_user_id = auth.uid()
          AND status_ativacao_ebd = true
      )
    )
    WITH CHECK (
      church_id IN (
        SELECT id FROM public.ebd_clientes
        WHERE superintendente_user_id = auth.uid()
          AND status_ativacao_ebd = true
      )
    );
  END IF;
END $$;

-- DELETE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ebd_professores'
      AND policyname = 'Superintendentes can delete professores'
  ) THEN
    CREATE POLICY "Superintendentes can delete professores"
    ON public.ebd_professores
    FOR DELETE
    USING (
      church_id IN (
        SELECT id FROM public.ebd_clientes
        WHERE superintendente_user_id = auth.uid()
          AND status_ativacao_ebd = true
      )
    );
  END IF;
END $$;