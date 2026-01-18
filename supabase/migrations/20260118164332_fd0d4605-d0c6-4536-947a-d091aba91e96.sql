-- Passo 1: Remover a política problemática que causa recursão infinita
DROP POLICY IF EXISTS "Professores podem ver co-professores das mesmas escalas" 
ON public.ebd_professores;

-- Passo 2: Criar função SECURITY DEFINER para buscar co-professores sem recursão
CREATE OR REPLACE FUNCTION get_co_professor_ids(p_user_id uuid)
RETURNS uuid[] 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT 
      CASE 
        WHEN e.professor_id = p.id THEN e.professor_id_2
        ELSE e.professor_id
      END
    ), 
    '{}'::uuid[]
  )
  FROM ebd_professores p
  JOIN ebd_escalas e ON e.professor_id = p.id OR e.professor_id_2 = p.id
  WHERE p.user_id = p_user_id
    AND (e.professor_id IS NOT NULL OR e.professor_id_2 IS NOT NULL);
$$;

-- Passo 3: Criar nova política usando a função auxiliar
CREATE POLICY "Professores podem ver co-professores via funcao"
ON public.ebd_professores
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  id = ANY(get_co_professor_ids(auth.uid()))
);