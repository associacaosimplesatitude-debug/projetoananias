-- Create helper function to fetch vendedor public fields for authenticated users
CREATE OR REPLACE FUNCTION public.get_vendedor_public(_vendedor_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'id', v.id,
    'nome', v.nome,
    'email', v.email,
    'foto_url', v.foto_url
  )
  FROM public.vendedores v
  WHERE v.id = _vendedor_id
  LIMIT 1;
$$;