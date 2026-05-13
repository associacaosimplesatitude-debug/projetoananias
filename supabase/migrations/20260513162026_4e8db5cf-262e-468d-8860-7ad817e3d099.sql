-- Etapa 2: Recriar get_auth_email como SECURITY DEFINER com search_path incluindo auth
CREATE OR REPLACE FUNCTION public.get_auth_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_email() TO authenticated, anon, service_role;

-- Etapa 3: Recriar policy vendedor_le_conversas_atribuidas usando auth.email() built-in
DROP POLICY IF EXISTS vendedor_le_conversas_atribuidas ON public.agente_ia_conversas;

CREATE POLICY vendedor_le_conversas_atribuidas
ON public.agente_ia_conversas
FOR SELECT
TO authenticated
USING (
  vendedor_atribuido_id IS NOT NULL
  AND vendedor_atribuido_id IN (
    SELECT id FROM public.vendedores
    WHERE lower(trim(email)) = lower(trim(coalesce(auth.email(), '')))
  )
);