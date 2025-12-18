-- Criar função segura para transferir cliente para vendedor
create or replace function public.transfer_cliente_vendedor(
  source text,
  cliente_id uuid,
  vendedor_id uuid
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

  if source = 'ebd_clientes' then
    update public.ebd_clientes
      set vendedor_id = transfer_cliente_vendedor.vendedor_id,
          updated_at = now()
    where id = transfer_cliente_vendedor.cliente_id;

    if not found then
      raise exception 'Cliente não encontrado em ebd_clientes';
    end if;

  elsif source = 'churches' then
    update public.churches
      set vendedor_id = transfer_cliente_vendedor.vendedor_id,
          updated_at = now()
    where id = transfer_cliente_vendedor.cliente_id;

    if not found then
      raise exception 'Cliente não encontrado em churches';
    end if;
  else
    raise exception 'Source inválido: %', source;
  end if;
end;
$$;

grant execute on function public.transfer_cliente_vendedor(text, uuid, uuid) to authenticated;
