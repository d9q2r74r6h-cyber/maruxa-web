create table if not exists public.reparto_planillas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  anio integer not null,
  mes integer not null check (mes between 1 and 12),
  repartidor_id uuid references public.funcionarios(id) on delete set null,
  repartidor_nombre text not null,
  saldo_inicial numeric not null default 0,
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, anio, mes, repartidor_nombre)
);

create table if not exists public.reparto_planilla_detalles (
  id uuid primary key default gen_random_uuid(),
  planilla_id uuid not null references public.reparto_planillas(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  cliente_sigla text not null,
  cliente_nombre text,
  fecha date not null,
  precio_unitario numeric not null default 0,
  kilos_vendidos numeric not null default 0,
  kilos_devueltos numeric not null default 0,
  monto_ajuste numeric not null default 0,
  observacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planilla_id, cliente_sigla, fecha)
);

create table if not exists public.reparto_planilla_abonos (
  id uuid primary key default gen_random_uuid(),
  planilla_id uuid not null references public.reparto_planillas(id) on delete cascade,
  fecha date not null,
  monto numeric not null default 0,
  observacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planilla_id, fecha)
);

create index if not exists idx_reparto_planillas_empresa_periodo
on public.reparto_planillas (empresa_id, anio desc, mes desc, repartidor_nombre);

create index if not exists idx_reparto_detalles_planilla_fecha
on public.reparto_planilla_detalles (planilla_id, fecha, cliente_sigla);

create index if not exists idx_reparto_abonos_planilla_fecha
on public.reparto_planilla_abonos (planilla_id, fecha);

drop trigger if exists reparto_planillas_updated_at on public.reparto_planillas;
create trigger reparto_planillas_updated_at
before update on public.reparto_planillas
for each row execute function public.actualizar_updated_at();

drop trigger if exists reparto_planilla_detalles_updated_at on public.reparto_planilla_detalles;
create trigger reparto_planilla_detalles_updated_at
before update on public.reparto_planilla_detalles
for each row execute function public.actualizar_updated_at();

drop trigger if exists reparto_planilla_abonos_updated_at on public.reparto_planilla_abonos;
create trigger reparto_planilla_abonos_updated_at
before update on public.reparto_planilla_abonos
for each row execute function public.actualizar_updated_at();

alter table public.reparto_planillas enable row level security;
alter table public.reparto_planilla_detalles enable row level security;
alter table public.reparto_planilla_abonos enable row level security;

drop policy if exists "reparto_planillas_empresa" on public.reparto_planillas;
create policy "reparto_planillas_empresa"
on public.reparto_planillas
for all
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

drop policy if exists "reparto_detalles_empresa" on public.reparto_planilla_detalles;
create policy "reparto_detalles_empresa"
on public.reparto_planilla_detalles
for all
using (
  exists (
    select 1
    from public.reparto_planillas p
    where p.id = reparto_planilla_detalles.planilla_id
      and p.empresa_id = public.usuario_empresa_id()
  )
)
with check (
  exists (
    select 1
    from public.reparto_planillas p
    where p.id = reparto_planilla_detalles.planilla_id
      and p.empresa_id = public.usuario_empresa_id()
  )
);

drop policy if exists "reparto_abonos_empresa" on public.reparto_planilla_abonos;
create policy "reparto_abonos_empresa"
on public.reparto_planilla_abonos
for all
using (
  exists (
    select 1
    from public.reparto_planillas p
    where p.id = reparto_planilla_abonos.planilla_id
      and p.empresa_id = public.usuario_empresa_id()
  )
)
with check (
  exists (
    select 1
    from public.reparto_planillas p
    where p.id = reparto_planilla_abonos.planilla_id
      and p.empresa_id = public.usuario_empresa_id()
  )
);

insert into public.modulos_erp (codigo, nombre, grupo, ruta, orden)
values ('repartos', 'Repartos mensuales', 'Comercial', '/admin/repartos', 23)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  grupo = excluded.grupo,
  ruta = excluded.ruta,
  orden = excluded.orden,
  activo = true;

insert into public.usuario_permisos (
  usuario_id,
  modulo_codigo,
  puede_ver,
  puede_crear,
  puede_editar,
  puede_eliminar
)
select
  perfil.id,
  'repartos',
  true,
  true,
  true,
  true
from public.perfiles_usuario perfil
where perfil.rol in ('superadmin', 'administrador')
on conflict (usuario_id, modulo_codigo) do update set
  puede_ver = excluded.puede_ver,
  puede_crear = excluded.puede_crear,
  puede_editar = excluded.puede_editar,
  puede_eliminar = excluded.puede_eliminar;
