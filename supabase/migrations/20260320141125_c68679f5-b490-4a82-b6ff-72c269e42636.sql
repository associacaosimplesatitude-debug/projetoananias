
-- Permitir SELECT público em sorteio_participantes (contador público)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'select_admin' AND tablename = 'sorteio_participantes') THEN
    DROP POLICY "select_admin" ON public.sorteio_participantes;
  END IF;
END $$;

CREATE POLICY "select_publico" ON public.sorteio_participantes FOR SELECT USING (true);

-- Permitir INSERT anônimo em embaixadoras_cliques
CREATE POLICY "permitir_insert_cliques_anon" ON public.embaixadoras_cliques FOR INSERT TO anon WITH CHECK (true);

-- Permitir UPDATE anônimo em embaixadoras_cliques (geo data)
CREATE POLICY "permitir_update_cliques_anon" ON public.embaixadoras_cliques FOR UPDATE TO anon USING (true) WITH CHECK (true);
