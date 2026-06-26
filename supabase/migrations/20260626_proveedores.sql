create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  rut text,
  razon_social text not null,
  nombre_fantasia text,
  giro text,
  direccion text,
  comuna text,
  ciudad text,
  email text,
  telefono text,
  contacto_nombre text,
  contacto_email text,
  contacto_telefono text,
  condiciones_pago text,
  dias_credito integer not null default 0,
  observaciones text,
  activo boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (empresa_id, rut)
);

create index if not exists idx_proveedores_empresa_nombre
on public.proveedores (empresa_id, razon_social);

alter table public.proveedores enable row level security;

drop policy if exists "proveedores_empresa" on public.proveedores;
create policy "proveedores_empresa"
on public.proveedores
for all
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

drop trigger if exists proveedores_updated_at on public.proveedores;
create trigger proveedores_updated_at
before update on public.proveedores
for each row execute function public.set_updated_at();

insert into public.modulos_erp (codigo, nombre, grupo, ruta, orden)
values ('proveedores', 'Proveedores', 'Inventario', '/admin/proveedores', 35)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  grupo = excluded.grupo,
  ruta = excluded.ruta,
  orden = excluded.orden;

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
  'proveedores',
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
