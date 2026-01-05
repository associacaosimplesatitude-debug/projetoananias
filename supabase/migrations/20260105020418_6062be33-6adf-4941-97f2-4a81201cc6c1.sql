-- Allow multiple superintendents per church via ebd_user_roles

-- 1) Helper function (security definer) to determine if a user is a superintendent of a given EBD church
create or replace function public.is_ebd_superintendent(_user_id uuid, _church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.ebd_clientes ec
      where ec.id = _church_id
        and ec.superintendente_user_id = _user_id
        and ec.status_ativacao_ebd = true
    )
    or exists (
      select 1
      from public.ebd_user_roles ur
      where ur.user_id = _user_id
        and ur.role = 'superintendente'
        and ur.church_id = _church_id
    );
$$;

-- 2) Policies for promoted superintendents (role-based)

-- ebd_clientes (uses id as church identifier)
drop policy if exists "Role superintendentes can view their church record" on public.ebd_clientes;
create policy "Role superintendentes can view their church record"
on public.ebd_clientes
for select
to authenticated
using (public.is_ebd_superintendent(auth.uid(), id));

drop policy if exists "Role superintendentes can update their church record" on public.ebd_clientes;
create policy "Role superintendentes can update their church record"
on public.ebd_clientes
for update
to authenticated
using (public.is_ebd_superintendent(auth.uid(), id))
with check (public.is_ebd_superintendent(auth.uid(), id));

-- ebd_alunos
drop policy if exists "Role superintendentes can manage alunos" on public.ebd_alunos;
create policy "Role superintendentes can manage alunos"
on public.ebd_alunos
for all
to authenticated
using (public.is_ebd_superintendent(auth.uid(), church_id))
with check (public.is_ebd_superintendent(auth.uid(), church_id));

-- ebd_professores
drop policy if exists "Role superintendentes can manage professores" on public.ebd_professores;
create policy "Role superintendentes can manage professores"
on public.ebd_professores
for all
to authenticated
using (public.is_ebd_superintendent(auth.uid(), church_id))
with check (public.is_ebd_superintendent(auth.uid(), church_id));

-- ebd_turmas
drop policy if exists "Role superintendentes can manage turmas" on public.ebd_turmas;
create policy "Role superintendentes can manage turmas"
on public.ebd_turmas
for all
to authenticated
using (public.is_ebd_superintendent(auth.uid(), church_id))
with check (public.is_ebd_superintendent(auth.uid(), church_id));

-- ebd_frequencia
drop policy if exists "Role superintendentes can manage frequencia" on public.ebd_frequencia;
create policy "Role superintendentes can manage frequencia"
on public.ebd_frequencia
for all
to authenticated
using (public.is_ebd_superintendent(auth.uid(), church_id))
with check (public.is_ebd_superintendent(auth.uid(), church_id));

-- ebd_dados_aula
drop policy if exists "Role superintendentes can manage dados_aula" on public.ebd_dados_aula;
create policy "Role superintendentes can manage dados_aula"
on public.ebd_dados_aula
for all
to authenticated
using (public.is_ebd_superintendent(auth.uid(), church_id))
with check (public.is_ebd_superintendent(auth.uid(), church_id));

-- ebd_planejamento
drop policy if exists "Role superintendentes can manage planejamento" on public.ebd_planejamento;
create policy "Role superintendentes can manage planejamento"
on public.ebd_planejamento
for all
to authenticated
using (public.is_ebd_superintendent(auth.uid(), church_id))
with check (public.is_ebd_superintendent(auth.uid(), church_id));

-- ebd_escalas
drop policy if exists "Role superintendentes can manage escalas" on public.ebd_escalas;
create policy "Role superintendentes can manage escalas"
on public.ebd_escalas
for all
to authenticated
using (public.is_ebd_superintendent(auth.uid(), church_id))
with check (public.is_ebd_superintendent(auth.uid(), church_id));

-- ebd_professores_turmas (ties professor to church via ebd_professores)
drop policy if exists "Role superintendentes can manage professores_turmas" on public.ebd_professores_turmas;
create policy "Role superintendentes can manage professores_turmas"
on public.ebd_professores_turmas
for all
to authenticated
using (
  exists (
    select 1
    from public.ebd_professores p
    where p.id = professor_id
      and public.is_ebd_superintendent(auth.uid(), p.church_id)
  )
)
with check (
  exists (
    select 1
    from public.ebd_professores p
    where p.id = professor_id
      and public.is_ebd_superintendent(auth.uid(), p.church_id)
  )
);
