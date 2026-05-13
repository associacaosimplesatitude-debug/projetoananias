CREATE OR REPLACE FUNCTION public.get_vendedor_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id 
  FROM public.vendedores 
  WHERE lower(trim(email)) = lower(trim(_email)) 
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendedor_id_by_email(text) TO authenticated, anon, service_role;