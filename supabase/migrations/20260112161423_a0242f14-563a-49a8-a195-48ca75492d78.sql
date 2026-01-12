
CREATE OR REPLACE FUNCTION public.transfer_cliente_vendedor(
  _source text,
  _cliente_id uuid,
  _vendedor_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _novo_email_bling TEXT;
  _novo_vendedor_nome TEXT;
BEGIN
  -- Permissão: apenas admin ou gerente_ebd
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) 
       OR public.has_role(auth.uid(), 'gerente_ebd'::public.app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para transferir cliente';
  END IF;
  
  -- Buscar email_bling e nome do novo vendedor (para sincronizar com Bling)
  IF _vendedor_id IS NOT NULL THEN
    SELECT COALESCE(email_bling, email), nome 
    INTO _novo_email_bling, _novo_vendedor_nome
    FROM public.vendedores
    WHERE id = _vendedor_id;
  END IF;

  IF _source = 'ebd_clientes' THEN
    UPDATE public.ebd_clientes
    SET vendedor_id = _vendedor_id,
        updated_at = now()
    WHERE id = _cliente_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente não encontrado em ebd_clientes';
    END IF;
    
    -- Atualizar propostas pendentes do cliente para o novo vendedor
    UPDATE public.vendedor_propostas
    SET vendedor_id = _vendedor_id,
        vendedor_nome = _novo_vendedor_nome,
        updated_at = now()
    WHERE cliente_id = _cliente_id
      AND status IN ('Em análise', 'Pendente');

  ELSIF _source = 'churches' THEN
    UPDATE public.churches
    SET vendedor_id = _vendedor_id,
        updated_at = now()
    WHERE id = _cliente_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente não encontrado em churches';
    END IF;
  ELSE
    RAISE EXCEPTION 'Source inválido: %', _source;
  END IF;
END;
$$;
