-- Política RLS para permitir professor ver co-professores das mesmas escalas
CREATE POLICY "Professores podem ver co-professores das mesmas escalas"
ON public.ebd_professores
FOR SELECT
USING (
  -- Pode ver o próprio registro
  user_id = auth.uid()
  OR
  -- Pode ver professores que estão em escalas junto com ele
  id IN (
    SELECT DISTINCT 
      CASE 
        WHEN e.professor_id = (SELECT ep.id FROM public.ebd_professores ep WHERE ep.user_id = auth.uid() LIMIT 1)
        THEN e.professor_id_2
        ELSE e.professor_id
      END
    FROM public.ebd_escalas e
    WHERE 
      e.professor_id = (SELECT ep.id FROM public.ebd_professores ep WHERE ep.user_id = auth.uid() LIMIT 1)
      OR e.professor_id_2 = (SELECT ep.id FROM public.ebd_professores ep WHERE ep.user_id = auth.uid() LIMIT 1)
  )
);