-- Mantiene una vigencia por fecha para la equivalencia Caja -> Planilla.
-- Las reglas nuevas no recalculan los períodos anteriores.
create table if not exists public.demasia_vigencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  vigente_desde date not null,
  ajuste_caja_a_planilla numeric(10,2) not null default 0.25
    check (ajuste_caja_a_planilla >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, vigente_desde)
);

create index if not exists demasia_vigencias_empresa_fecha_idx
  on public.demasia_vigencias (empresa_id, vigente_desde desc);

alter table public.demasia_vigencias enable row level security;

drop policy if exists demasia_vigencias_empresa on public.demasia_vigencias;
create policy demasia_vigencias_empresa
on public.demasia_vigencias
for all
to authenticated
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

drop trigger if exists demasia_vigencias_updated_at on public.demasia_vigencias;
create trigger demasia_vigencias_updated_at
before update on public.demasia_vigencias
for each row execute function public.set_updated_at();

-- La regla vigente hasta ahora queda registrada como historial inicial.
insert into public.demasia_vigencias (empresa_id, vigente_desde, ajuste_caja_a_planilla)
select id, date '2026-01-01', 0.25
from public.empresas
on conflict (empresa_id, vigente_desde) do nothing;

comment on table public.demasia_vigencias is
  'Historial de equivalencia entre demasía registrada en Caja y demasía de Planilla.';
