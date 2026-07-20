create table if not exists public.combustible_hornos_equipos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  combustible text not null check (combustible in ('petroleo', 'gas')),
  unidad_nivel text not null check (unidad_nivel in ('litros', 'porcentaje')),
  capacidad_estanque numeric check (capacidad_estanque is null or capacidad_estanque > 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, codigo),
  check (unidad_nivel <> 'porcentaje' or capacidad_estanque is not null)
);

create table if not exists public.combustible_hornos_cargas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  equipo_id uuid not null references public.combustible_hornos_equipos(id) on delete cascade,
  fecha date not null,
  numero_documento text,
  proveedor text,
  precio_litro numeric not null default 0 check (precio_litro >= 0),
  monto_factura numeric not null default 0 check (monto_factura >= 0),
  litros_cargados numeric not null default 0 check (litros_cargados >= 0),
  nivel_restante numeric not null check (nivel_restante >= 0),
  observacion text,
  origen text not null default 'manual',
  origen_fila integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, origen, origen_fila)
);

create index if not exists combustible_hornos_equipos_empresa_idx
  on public.combustible_hornos_equipos (empresa_id, activo, nombre);
create index if not exists combustible_hornos_cargas_periodo_idx
  on public.combustible_hornos_cargas (empresa_id, fecha desc, equipo_id);

drop trigger if exists combustible_hornos_equipos_updated_at on public.combustible_hornos_equipos;
create trigger combustible_hornos_equipos_updated_at before update on public.combustible_hornos_equipos
for each row execute function public.actualizar_updated_at();

drop trigger if exists combustible_hornos_cargas_updated_at on public.combustible_hornos_cargas;
create trigger combustible_hornos_cargas_updated_at before update on public.combustible_hornos_cargas
for each row execute function public.actualizar_updated_at();

alter table public.combustible_hornos_equipos enable row level security;
alter table public.combustible_hornos_cargas enable row level security;

drop policy if exists "combustible_hornos_equipos_empresa" on public.combustible_hornos_equipos;
create policy "combustible_hornos_equipos_empresa" on public.combustible_hornos_equipos for all
using (empresa_id = public.usuario_empresa_id()) with check (empresa_id = public.usuario_empresa_id());

drop policy if exists "combustible_hornos_cargas_empresa" on public.combustible_hornos_cargas;
create policy "combustible_hornos_cargas_empresa" on public.combustible_hornos_cargas for all
using (empresa_id = public.usuario_empresa_id()) with check (empresa_id = public.usuario_empresa_id());

insert into public.modulos_erp (codigo, nombre, grupo, ruta, orden)
values ('combustible_hornos', 'Combustible de hornos', 'Informes', '/admin/informes/combustible-hornos', 126)
on conflict (codigo) do update set nombre = excluded.nombre, grupo = excluded.grupo,
  ruta = excluded.ruta, orden = excluded.orden, activo = true;

insert into public.usuario_permisos (
  usuario_id, modulo_codigo, puede_ver, puede_crear, puede_editar, puede_eliminar
)
select id, 'combustible_hornos', true, true, true, true
from public.perfiles_usuario where rol in ('superadmin', 'administrador')
on conflict (usuario_id, modulo_codigo) do update set puede_ver = true, puede_crear = true,
  puede_editar = true, puede_eliminar = true;

insert into public.combustible_hornos_equipos (
  empresa_id, codigo, nombre, combustible, unidad_nivel, capacidad_estanque
)
select id, 'PETROLEO-HORNOS', 'Petróleo hornos', 'petroleo', 'litros', null
from public.empresas where slug = 'maruxa' limit 1
on conflict (empresa_id, codigo) do update set nombre = excluded.nombre,
  combustible = excluded.combustible, unidad_nivel = excluded.unidad_nivel,
  capacidad_estanque = excluded.capacidad_estanque, activo = true;

insert into public.combustible_hornos_equipos (
  empresa_id, codigo, nombre, combustible, unidad_nivel, capacidad_estanque
)
select id, 'GAS-HORNOS', 'Gas hornos', 'gas', 'porcentaje', 1655
from public.empresas where slug = 'maruxa' limit 1
on conflict (empresa_id, codigo) do update set nombre = excluded.nombre,
  combustible = excluded.combustible, unidad_nivel = excluded.unidad_nivel,
  capacidad_estanque = excluded.capacidad_estanque, activo = true;
