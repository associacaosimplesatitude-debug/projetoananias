-- 1. Função SECURITY DEFINER que retorna o vendedor_id do usuário logado
CREATE OR REPLACE FUNCTION public.current_vendedor_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT v.id
  FROM public.vendedores v
  JOIN auth.users u 
    ON lower(trim(u.email)) = lower(trim(v.email))
  WHERE u.id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_vendedor_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_vendedor_id() TO authenticated, anon, service_role;

-- 2. Recria a policy usando apenas a função (sem subquery em vendedores)
DROP POLICY IF EXISTS vendedor_le_conversas_atribuidas ON public.agente_ia_conversas;

CREATE POLICY vendedor_le_conversas_atribuidas
ON public.agente_ia_conversas
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  vendedor_atribuido_id IS NOT NULL
  AND vendedor_atribuido_id = public.current_vendedor_id()
);

-- 3. Força reload do cache do PostgREST
NOTIFY pgrst, 'reload schema';