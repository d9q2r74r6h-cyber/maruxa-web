alter table public.vehiculos_reparto
  add column if not exists repartidor_id uuid references public.funcionarios(id) on delete set null,
  add column if not exists marca text,
  add column if not exists modelo text,
  add column if not exists anio smallint,
  add column if not exists tipo text,
  add column if not exists color text,
  add column if not exists kilometraje_actual numeric(12, 1) not null default 0,
  add column if not exists estado text not null default 'activo',
  add column if not exists revision_tecnica_vence date,
  add column if not exists permiso_circulacion_vence date,
  add column if not exists seguro_vence date,
  add column if not exists observacion text;

create unique index if not exists vehiculos_reparto_repartidor_activo_key
  on public.vehiculos_reparto (empresa_id, repartidor_id)
  where activo = true and repartidor_id is not null;

update public.vehiculos_reparto v
set repartidor_id = f.id
from public.funcionarios f
where f.empresa_id = v.empresa_id
  and f.activo = true
  and lower(f.cargo) = 'repartidor'
  and (
    (v.codigo = 'RANTUL' and lower(f.nombre_completo) = 'luis rantul')
    or (v.codigo = 'ALBORNOZ' and lower(f.nombre_completo) = 'luis albornoz')
  )
  and v.repartidor_id is null;

create table if not exists public.vehiculo_alerta_politicas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  dias_anticipacion integer not null default 30 check (dias_anticipacion >= 0),
  km_anticipacion integer not null default 500 check (km_anticipacion >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, codigo)
);

create table if not exists public.vehiculo_registros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  vehiculo_id uuid not null references public.vehiculos_reparto(id) on delete cascade,
  politica_id uuid references public.vehiculo_alerta_politicas(id) on delete set null,
  tipo text not null default 'mantencion',
  titulo text not null,
  fecha date not null,
  kilometraje numeric(12, 1),
  costo numeric(14, 2) not null default 0,
  detalle text,
  proxima_fecha date,
  proximo_kilometraje numeric(12, 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehiculo_registros_vehiculo_fecha_idx
  on public.vehiculo_registros (vehiculo_id, fecha desc);
create index if not exists vehiculo_alerta_politicas_empresa_idx
  on public.vehiculo_alerta_politicas (empresa_id, activo, nombre);

drop trigger if exists vehiculo_alerta_politicas_updated_at on public.vehiculo_alerta_politicas;
create trigger vehiculo_alerta_politicas_updated_at
before update on public.vehiculo_alerta_politicas
for each row execute function public.set_updated_at();

drop trigger if exists vehiculo_registros_updated_at on public.vehiculo_registros;
create trigger vehiculo_registros_updated_at
before update on public.vehiculo_registros
for each row execute function public.set_updated_at();

alter table public.vehiculo_alerta_politicas enable row level security;
alter table public.vehiculo_registros enable row level security;

drop policy if exists "vehiculo_alerta_politicas_empresa" on public.vehiculo_alerta_politicas;
create policy "vehiculo_alerta_politicas_empresa"
on public.vehiculo_alerta_politicas for all
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

drop policy if exists "vehiculo_registros_empresa" on public.vehiculo_registros;
create policy "vehiculo_registros_empresa"
on public.vehiculo_registros for all
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

insert into public.vehiculo_alerta_politicas (
  empresa_id, codigo, nombre, dias_anticipacion, km_anticipacion
)
select e.id, p.codigo, p.nombre, p.dias, p.km
from public.empresas e
cross join (values
  ('revision_tecnica', 'Revisión técnica', 30, 0),
  ('permiso_circulacion', 'Permiso de circulación', 30, 0),
  ('seguro', 'Seguro obligatorio', 30, 0),
  ('cambio_aceite', 'Cambio de aceite', 15, 500),
  ('mantencion_general', 'Mantención general', 30, 1000)
) as p(codigo, nombre, dias, km)
where e.slug = 'maruxa'
on conflict (empresa_id, codigo) do nothing;

update public.vehiculos_reparto v
set kilometraje_actual = datos.kilometraje
from (
  select vehiculo_id, max(kilometraje) as kilometraje
  from public.combustible_cargas
  where kilometraje is not null
  group by vehiculo_id
) datos
where datos.vehiculo_id = v.id
  and datos.kilometraje > v.kilometraje_actual;

insert into public.modulos_sistema (codigo, nombre, grupo, ruta, orden, activo)
values ('vehiculos', 'Vehículos', 'Inventario', '/admin/vehiculos', 35, true)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  grupo = excluded.grupo,
  ruta = excluded.ruta,
  orden = excluded.orden,
  activo = true;

insert into public.usuario_permisos (
  usuario_id, modulo_codigo, puede_ver, puede_crear, puede_editar, puede_eliminar
)
select id, 'vehiculos', true, true, true, true
from public.perfiles_usuario
where rol in ('superadmin', 'administrador')
on conflict (usuario_id, modulo_codigo) do update set
  puede_ver = true,
  puede_crear = true,
  puede_editar = true,
  puede_eliminar = true;
