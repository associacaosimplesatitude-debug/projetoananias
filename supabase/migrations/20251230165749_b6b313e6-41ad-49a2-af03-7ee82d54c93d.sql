-- Allow professors/students to read planning for their church (needed for Desafio Bíblico da Semana)
ALTER TABLE public.ebd_planejamento ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
      AND tablename = 'ebd_planejamento'
      AND policyname = 'Professores podem visualizar planejamento da sua igreja'
  ) THEN
    CREATE POLICY "Professores podem visualizar planejamento da sua igreja"
    ON public.ebd_planejamento
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.ebd_professores p
        WHERE p.user_id = auth.uid()
          AND p.is_active = true
          AND p.church_id = ebd_planejamento.church_id
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
      AND tablename = 'ebd_planejamento'
      AND policyname = 'Alunos podem visualizar planejamento da sua igreja'
  ) THEN
    CREATE POLICY "Alunos podem visualizar planejamento da sua igreja"
    ON public.ebd_planejamento
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.ebd_alunos a
        WHERE a.user_id = auth.uid()
          AND a.is_active = true
          AND a.church_id = ebd_planejamento.church_id
      )
    );
  END IF;
END $$;