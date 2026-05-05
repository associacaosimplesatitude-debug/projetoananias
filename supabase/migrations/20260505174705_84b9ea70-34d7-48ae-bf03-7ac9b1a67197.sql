create table public.retencao_disparos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null,
  telefone text not null,
  template_nome text not null,
  faixa text not null check (faixa in ('atencao','critico','urgente')),
  status text not null check (status in ('sucesso','falha')),
  meta_message_id text,
  erro text,
  enviado_por uuid references auth.users(id),
  enviado_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_retencao_disparos_cliente on public.retencao_disparos(cliente_id);
create index idx_retencao_disparos_enviado_em on public.retencao_disparos(enviado_em desc);
create index idx_retencao_disparos_status on public.retencao_disparos(status);

alter table public.retencao_disparos enable row level security;

create policy "admin/gerente leem todos disparos"
  on public.retencao_disparos for select
  using (exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role in ('admin','gerente_ebd')
  ));