drop policy if exists "Allow authenticated users to manage bling_config_penha" on public.bling_config_penha;

create policy "Admins manage bling_config_penha"
on public.bling_config_penha
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "select_publico" on public.sorteio_participantes;

create policy "Admins and sorteio managers view participantes"
on public.sorteio_participantes
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'gerente_sorteio')
);

drop policy if exists "select_publico_embaixadoras" on public.embaixadoras;
drop policy if exists "update_admin_embaixadoras" on public.embaixadoras;

create policy "Admins and sorteio managers view embaixadoras"
on public.embaixadoras
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'gerente_sorteio')
  or exists (
    select 1
    from public.sorteio_participantes sp
    where sp.id = embaixadoras.participante_id
      and (
        lower(trim(coalesce(sp.email, ''))) = lower(trim(coalesce(auth.email(), '')))
        or regexp_replace(coalesce(sp.whatsapp, ''), '\\D', '', 'g') = regexp_replace(coalesce(auth.jwt() ->> 'phone', ''), '\\D', '', 'g')
      )
  )
);

create policy "Admins, sorteio managers or owner update embaixadoras"
on public.embaixadoras
for update
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'gerente_sorteio')
  or exists (
    select 1
    from public.sorteio_participantes sp
    where sp.id = embaixadoras.participante_id
      and (
        lower(trim(coalesce(sp.email, ''))) = lower(trim(coalesce(auth.email(), '')))
        or regexp_replace(coalesce(sp.whatsapp, ''), '\\D', '', 'g') = regexp_replace(coalesce(auth.jwt() ->> 'phone', ''), '\\D', '', 'g')
      )
  )
)
with check (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'gerente_sorteio')
  or exists (
    select 1
    from public.sorteio_participantes sp
    where sp.id = embaixadoras.participante_id
      and (
        lower(trim(coalesce(sp.email, ''))) = lower(trim(coalesce(auth.email(), '')))
        or regexp_replace(coalesce(sp.whatsapp, ''), '\\D', '', 'g') = regexp_replace(coalesce(auth.jwt() ->> 'phone', ''), '\\D', '', 'g')
      )
  )
);