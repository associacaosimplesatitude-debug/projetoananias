create table public.retencao_campanhas (
  id uuid primary key default gen_random_uuid(),
  iniciada_por uuid references auth.users(id),
  faixa text not null,
  limite integer,
  excluir_recentes boolean,
  total_alvo integer not null default 0,
  enviadas integer not null default 0,
  sucessos integer not null default 0,
  falhas integer not null default 0,
  status text not null default 'processando' check (status in ('processando','concluida','erro')),
  erro text,
  iniciada_em timestamptz not null default now(),
  concluida_em timestamptz,
  created_at timestamptz not null default now()
);

create index idx_retencao_campanhas_status on public.retencao_campanhas(status);
create index idx_retencao_campanhas_iniciada on public.retencao_campanhas(iniciada_em desc);

alter table public.retencao_campanhas enable row level security;

create policy "admin/gerente leem campanhas"
  on public.retencao_campanhas for select
  using (exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role in ('admin','gerente_ebd')
  ));

alter publication supabase_realtime add table public.retencao_campanhas;