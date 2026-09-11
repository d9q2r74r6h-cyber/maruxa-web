create table if not exists public.licitacion_alertas_enviadas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo text not null check (tipo in ('licitacion','compra_agil','sistema')),
  codigo text not null,
  enviado_en timestamptz not null default now(),
  unique (empresa_id,tipo,codigo)
);
create index if not exists licitacion_alertas_empresa_idx on public.licitacion_alertas_enviadas (empresa_id,enviado_en desc);
alter table public.licitacion_alertas_enviadas enable row level security;
drop policy if exists "licitacion_alertas_empresa" on public.licitacion_alertas_enviadas;
create policy "licitacion_alertas_empresa" on public.licitacion_alertas_enviadas for all to authenticated
using (empresa_id=public.usuario_empresa_id()) with check (empresa_id=public.usuario_empresa_id());
