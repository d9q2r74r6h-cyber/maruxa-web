create table if not exists public.cargos_empresa (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists cargos_empresa_nombre_idx on public.cargos_empresa (empresa_id, upper(nombre));

create table if not exists public.funcionario_cargos (
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  cargo_id uuid not null references public.cargos_empresa(id) on delete cascade,
  primary key (funcionario_id, cargo_id)
);

insert into public.cargos_empresa (empresa_id, nombre)
select distinct empresa_id, trim(cargo) from public.funcionarios where trim(coalesce(cargo, '')) <> ''
on conflict do nothing;

insert into public.funcionario_cargos (funcionario_id, cargo_id)
select f.id, c.id from public.funcionarios f join public.cargos_empresa c
  on c.empresa_id = f.empresa_id and upper(c.nombre) = upper(trim(f.cargo))
on conflict do nothing;

alter table public.cargos_empresa enable row level security;
alter table public.funcionario_cargos enable row level security;
drop policy if exists "cargos_empresa_propietaria" on public.cargos_empresa;
create policy "cargos_empresa_propietaria" on public.cargos_empresa for all
using (empresa_id = public.usuario_empresa_id()) with check (empresa_id = public.usuario_empresa_id());
drop policy if exists "funcionario_cargos_empresa" on public.funcionario_cargos;
create policy "funcionario_cargos_empresa" on public.funcionario_cargos for all
using (exists (select 1 from public.funcionarios f where f.id = funcionario_id and f.empresa_id = public.usuario_empresa_id()))
with check (exists (select 1 from public.funcionarios f where f.id = funcionario_id and f.empresa_id = public.usuario_empresa_id()));
