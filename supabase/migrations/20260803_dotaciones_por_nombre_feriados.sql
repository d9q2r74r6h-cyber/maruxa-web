alter table public.caja_dotaciones_semanales
  alter column semana_desde drop not null;

alter table public.caja_dotaciones_semanales
  add column if not exists nombre text,
  add column if not exists turnos jsonb not null default '[]'::jsonb;

update public.caja_dotaciones_semanales
set nombre = coalesce(nombre, 'DOTACIÓN ' || to_char(semana_desde, 'DD-MM-YYYY'))
where nombre is null;

create unique index if not exists caja_dotaciones_empresa_nombre_idx
  on public.caja_dotaciones_semanales (empresa_id, upper(nombre));

create table if not exists public.caja_feriados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  fecha date not null,
  nombre text not null,
  unique (empresa_id, fecha)
);

alter table public.caja_feriados enable row level security;
drop policy if exists "caja_feriados_empresa" on public.caja_feriados;
create policy "caja_feriados_empresa" on public.caja_feriados for all
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

alter table public.caja_cierres
  add column if not exists dotacion_id uuid references public.caja_dotaciones_semanales(id) on delete set null;
