CREATE OR REPLACE FUNCTION public.increment_comissao(emb_id uuid, valor numeric)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE embaixadoras
  SET total_comissao = COALESCE(total_comissao, 0) + valor
  WHERE id = emb_id
  RETURNING total_comissao;
$$;