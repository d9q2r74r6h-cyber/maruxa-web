create table if not exists public.cargo_remuneraciones_especiales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cargo_id uuid not null references public.cargos_empresa(id) on delete cascade,
  vigente_desde date not null,
  configuracion jsonb not null,
  created_at timestamptz not null default now(),
  unique (cargo_id, vigente_desde)
);
create index if not exists cargo_remuneraciones_vigencia_idx on public.cargo_remuneraciones_especiales (cargo_id, vigente_desde desc);
alter table public.cargo_remuneraciones_especiales enable row level security;
drop policy if exists "cargo_remuneraciones_empresa" on public.cargo_remuneraciones_especiales;
create policy "cargo_remuneraciones_empresa" on public.cargo_remuneraciones_especiales for all
using (empresa_id = public.usuario_empresa_id()) with check (empresa_id = public.usuario_empresa_id());

insert into public.cargo_remuneraciones_especiales (empresa_id,cargo_id,vigente_desde,configuracion)
select empresa_id,id,date '2026-01-01',configuracion_pago from public.cargos_empresa
where modalidad_pago='panadero' and configuracion_pago <> '{}'::jsonb
on conflict do nothing;
