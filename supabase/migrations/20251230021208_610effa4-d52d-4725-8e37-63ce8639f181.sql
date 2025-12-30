-- Corrigir policy restritiva que estava bloqueando superintendentes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ebd_escalas'
      AND policyname = 'Gerente EBD can manage escalas'
  ) THEN
    EXECUTE 'DROP POLICY "Gerente EBD can manage escalas" ON public.ebd_escalas';
  END IF;
END$$;

-- Recriar como PERMISSIVE (não bloqueia outras policies)
CREATE POLICY "Gerente EBD can manage escalas"
ON public.ebd_escalas
AS PERMISSIVE
FOR ALL
USING (public.has_role(auth.uid(), 'gerente_ebd'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'gerente_ebd'::public.app_role));