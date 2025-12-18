-- Recriar função com nomes de parâmetros compatíveis com PostgREST (_source, _cliente_id, _vendedor_id)
drop function if exists public.transfer_cliente_vendedor(text, uuid, uuid);

create function public.transfer_cliente_vendedor(
  _source text,
  _cliente_id uuid,
  _vendedor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Permissão: apenas admin ou gerente_ebd
  if not (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'gerente_ebd'::public.app_role)) then
    raise exception 'Sem permissão para transferir cliente';
  end if;

  if _source = 'ebd_clientes' then
    update public.ebd_clientes
      set vendedor_id = _vendedor_id,
          updated_at = now()
    where id = _cliente_id;

    if not found then
      raise exception 'Cliente não encontrado em ebd_clientes';
    end if;

  elsif _source = 'churches' then
    update public.churches
      set vendedor_id = _vendedor_id,
          updated_at = now()
    where id = _cliente_id;

    if not found then
      raise exception 'Cliente não encontrado em churches';
    end if;
  else
    raise exception 'Source inválido: %', _source;
  end if;
end;
$$;

grant execute on function public.transfer_cliente_vendedor(text, uuid, uuid) to authenticated;
