-- Função para buscar cliente por documento (CNPJ/CPF) com SECURITY DEFINER
-- Contorna RLS para permitir que vendedores vejam o nome do vendedor dono do cliente
CREATE OR REPLACE FUNCTION public.get_cliente_by_documento(_documento text)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resultado JSON;
  documento_limpo TEXT;
BEGIN
  -- Remove formatação do documento
  documento_limpo := regexp_replace(_documento, '[^0-9]', '', 'g');
  
  SELECT json_build_object(
    'id', ec.id,
    'nome_igreja', ec.nome_igreja,
    'vendedor_id', ec.vendedor_id,
    'vendedor_nome', v.nome
  )
  INTO resultado
  FROM public.ebd_clientes ec
  LEFT JOIN public.vendedores v ON ec.vendedor_id = v.id
  WHERE regexp_replace(ec.cnpj, '[^0-9]', '', 'g') = documento_limpo 
     OR regexp_replace(ec.cpf, '[^0-9]', '', 'g') = documento_limpo
  LIMIT 1;
  
  RETURN resultado;
END;
$$;