create table if not exists public.vehiculos_reparto (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  patente text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, codigo)
);

create table if not exists public.combustible_cargas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  vehiculo_id uuid not null references public.vehiculos_reparto(id) on delete cascade,
  fecha date not null,
  conductor_nombre text,
  numero_guia text,
  precio_litro numeric not null default 0 check (precio_litro >= 0),
  monto_guia numeric not null default 0 check (monto_guia >= 0),
  litros numeric not null check (litros > 0),
  kilometraje numeric check (kilometraje is null or kilometraje >= 0),
  observacion text,
  origen text not null default 'manual',
  origen_fila integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, origen, origen_fila)
);

create index if not exists vehiculos_reparto_empresa_idx
  on public.vehiculos_reparto (empresa_id, activo, nombre);
create index if not exists combustible_cargas_periodo_idx
  on public.combustible_cargas (empresa_id, fecha desc, vehiculo_id);

drop trigger if exists vehiculos_reparto_updated_at on public.vehiculos_reparto;
create trigger vehiculos_reparto_updated_at
before update on public.vehiculos_reparto
for each row execute function public.actualizar_updated_at();

drop trigger if exists combustible_cargas_updated_at on public.combustible_cargas;
create trigger combustible_cargas_updated_at
before update on public.combustible_cargas
for each row execute function public.actualizar_updated_at();

alter table public.vehiculos_reparto enable row level security;
alter table public.combustible_cargas enable row level security;

drop policy if exists "vehiculos_reparto_empresa" on public.vehiculos_reparto;
create policy "vehiculos_reparto_empresa"
on public.vehiculos_reparto for all
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

drop policy if exists "combustible_cargas_empresa" on public.combustible_cargas;
create policy "combustible_cargas_empresa"
on public.combustible_cargas for all
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

insert into public.modulos_erp (codigo, nombre, grupo, ruta, orden)
values (
  'rendimiento_vehiculos',
  'Rendimiento de vehiculos',
  'Informes',
  '/admin/informes/rendimiento-vehiculos',
  125
)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  grupo = excluded.grupo,
  ruta = excluded.ruta,
  orden = excluded.orden,
  activo = true;

insert into public.usuario_permisos (
  usuario_id, modulo_codigo, puede_ver, puede_crear, puede_editar, puede_eliminar
)
select id, 'rendimiento_vehiculos', true, true, true, true
from public.perfiles_usuario
where rol in ('superadmin', 'administrador')
on conflict (usuario_id, modulo_codigo) do update set
  puede_ver = true,
  puede_crear = true,
  puede_editar = true,
  puede_eliminar = true;

insert into public.vehiculos_reparto (empresa_id, codigo, nombre, patente)
select id, 'RANTUL', 'Camioneta Luis Rantul', 'VU 3159'
from public.empresas
where slug = 'maruxa'
limit 1
  on conflict (empresa_id, codigo) do update set
    nombre = excluded.nombre,
    patente = excluded.patente,
    activo = true;

insert into public.vehiculos_reparto (empresa_id, codigo, nombre, patente)
select id, 'ALBORNOZ', 'Lifan Luis Albornoz', null
from public.empresas
where slug = 'maruxa'
limit 1
  on conflict (empresa_id, codigo) do update set
    nombre = excluded.nombre,
    activo = true;

insert into public.vehiculos_reparto (empresa_id, codigo, nombre, patente)
select id, 'REEMPLAZO', 'Camioneta de reemplazo', 'BR WC-65'
from public.empresas
where slug = 'maruxa'
limit 1
  on conflict (empresa_id, codigo) do update set
    nombre = excluded.nombre,
    patente = excluded.patente,
    activo = true;

insert into public.combustible_cargas (
    empresa_id, vehiculo_id, fecha, conductor_nombre, numero_guia,
    precio_litro, monto_guia, litros, kilometraje, observacion, origen, origen_fila
)
select e.id, v.id, x.fecha, 'Luis Rantul', x.guia, x.precio,
    x.monto, x.litros, x.kilometraje, x.observacion, 'excel_2024_rantul', x.fila
from public.empresas e
join public.vehiculos_reparto v on v.empresa_id = e.id and v.codigo = 'RANTUL'
cross join (values
    (6, date '2024-02-02', '23951', 1013::numeric, 31800::numeric, 31.395::numeric, 169165::numeric, null::text),
    (7, date '2024-02-07', '24258', 1013, 32300, 31.887, 169645, null),
    (8, date '2024-02-12', '24319', 1030, 34000, 30.010, null, 'Kilometraje ausente en Excel'),
    (9, date '2024-02-22', '24096', 1030, 34150, 33.150, null, 'Kilometraje ausente en Excel'),
    (10, date '2024-03-02', '24378', 1047, 30900, 29.500, 170841, null),
    (11, date '2024-03-11', '24502', 1047, 33200, 31.700, 171222, null),
    (12, date '2024-03-18', '24599', 1047, 32000, 30.860, 171622, null),
    (13, date '2024-03-23', '24718', 1064, 35500, 33.370, 172110, null),
    (14, date '2024-03-28', '24751', 1064, 34360, 32.290, 172578, null),
    (15, date '2024-04-02', '24801', 1064, 32000, 30.070, 173002, null),
    (16, date '2024-04-06', '24872', 1064, 35700, 33.550, 173499, null),
    (17, date '2024-04-11', '24922', 1081, 33200, 30.710, 173941, null),
    (18, date '2024-04-15', '24964', 1081, 31500, 29.140, 174357, null)
  ) as x(fila, fecha, guia, precio, monto, litros, kilometraje, observacion)
where e.slug = 'maruxa'
on conflict (empresa_id, origen, origen_fila) do update set
    vehiculo_id = excluded.vehiculo_id,
    fecha = excluded.fecha,
    conductor_nombre = excluded.conductor_nombre,
    numero_guia = excluded.numero_guia,
    precio_litro = excluded.precio_litro,
    monto_guia = excluded.monto_guia,
    litros = excluded.litros,
    kilometraje = excluded.kilometraje,
    observacion = excluded.observacion;

insert into public.combustible_cargas (
    empresa_id, vehiculo_id, fecha, conductor_nombre, numero_guia,
    precio_litro, monto_guia, litros, kilometraje, observacion, origen, origen_fila
)
select e.id, v.id, x.fecha, 'Luis Albornoz', x.guia, x.precio,
    x.monto, x.litros, x.kilometraje, x.observacion, 'excel_2024_albornoz', x.fila
from public.empresas e
join public.vehiculos_reparto v on v.empresa_id = e.id and v.codigo = 'ALBORNOZ'
cross join (values
    (3, date '2024-02-02', '23953', 1284::numeric, 45000::numeric, 35.054::numeric, 16611::numeric, null::text),
    (4, date '2024-02-09', '24287', 1312, 46800, 35.600, 16889, null),
    (5, date '2024-02-15', '24004', 1313, 47200, 35.900, null, 'Kilometraje ausente en Excel'),
    (6, date '2024-02-21', '24075', 1313, 47200, 35.900, 17510, null),
    (7, date '2024-02-27', '24214', 1313, 50550, 38.500, 17850, null),
    (8, date '2024-03-03', '24381', 1344, 46400, 34.500, 18138, null),
    (9, date '2024-03-10', '24467', 1344, 52560, 39.100, 18458, null),
    (10, date '2024-03-13', '24536', 1344, 50030, 37.200, 18771, null),
    (11, date '2024-03-18', '24600', 1344, 46180, 34.300, 19066, null),
    (12, date '2024-03-23', '24722', 1376, 49000, 35.600, 19358, null),
    (13, date '2024-03-28', '24752', 1376, 50930, 37.000, null, 'Kilometraje ausente en Excel'),
    (14, date '2024-04-02', '24805', 1376, 51400, 37.300, 19980, null),
    (15, date '2024-04-06', '24871', 1376, 46200, 33.500, 20254, null),
    (16, date '2024-04-11', '24923', 1409, 50450, 35.800, null, 'Kilometraje ausente en Excel'),
    (17, date '2024-04-15', '24971', 1409, 50650, 35.900, 20843, null)
  ) as x(fila, fecha, guia, precio, monto, litros, kilometraje, observacion)
where e.slug = 'maruxa'
on conflict (empresa_id, origen, origen_fila) do update set
    vehiculo_id = excluded.vehiculo_id,
    fecha = excluded.fecha,
    conductor_nombre = excluded.conductor_nombre,
    numero_guia = excluded.numero_guia,
    precio_litro = excluded.precio_litro,
    monto_guia = excluded.monto_guia,
    litros = excluded.litros,
    kilometraje = excluded.kilometraje,
    observacion = excluded.observacion;

insert into public.combustible_cargas (
    empresa_id, vehiculo_id, fecha, conductor_nombre, numero_guia,
    precio_litro, monto_guia, litros, kilometraje, observacion, origen, origen_fila
)
select e.id, v.id, date '2024-03-26', 'Luis Rantul', '24612',
  1316, 20020, 15.200, null, 'Kilometraje ausente en Excel',
  'excel_2024_reemplazo', 3
from public.empresas e
join public.vehiculos_reparto v on v.empresa_id = e.id and v.codigo = 'REEMPLAZO'
where e.slug = 'maruxa'
on conflict (empresa_id, origen, origen_fila) do update set
    vehiculo_id = excluded.vehiculo_id,
    fecha = excluded.fecha,
    conductor_nombre = excluded.conductor_nombre,
    numero_guia = excluded.numero_guia,
    precio_litro = excluded.precio_litro,
    monto_guia = excluded.monto_guia,
    litros = excluded.litros,
    kilometraje = excluded.kilometraje,
    observacion = excluded.observacion;
