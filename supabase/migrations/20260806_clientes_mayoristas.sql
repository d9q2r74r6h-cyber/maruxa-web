create table if not exists public.clientes_mayoristas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  auth_user_id uuid unique,
  cliente_id uuid references public.clientes(id) on delete set null,
  razon_social text not null,
  rut text not null,
  giro text,
  contacto_nombre text not null,
  email text not null,
  telefono text not null,
  empresa_direccion text not null,
  empresa_comuna text not null,
  empresa_ciudad text not null,
  empresa_region text not null,
  despacho_a_empresa boolean not null default true,
  despacho_direccion text,
  despacho_comuna text,
  despacho_ciudad text,
  despacho_region text,
  despacho_referencia text,
  volumen_estimado text,
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado','suspendido')),
  descuento_porcentaje numeric not null default 0 check (descuento_porcentaje between 0 and 100),
  pedido_minimo numeric not null default 0,
  despacho_habilitado boolean not null default false,
  condicion_pago text,
  observaciones_internas text,
  aprobado_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, rut),
  unique (empresa_id, email)
);

create table if not exists public.mayorista_producto_precios (
  id uuid primary key default gen_random_uuid(),
  mayorista_id uuid not null references public.clientes_mayoristas(id) on delete cascade,
  producto_id bigint not null references public.productos(id) on delete cascade,
  precio numeric not null check (precio >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mayorista_id, producto_id)
);

create index if not exists clientes_mayoristas_empresa_estado_idx on public.clientes_mayoristas(empresa_id,estado,created_at desc);
alter table public.clientes_mayoristas enable row level security;
alter table public.mayorista_producto_precios enable row level security;

drop policy if exists "mayoristas_empresa_erp" on public.clientes_mayoristas;
create policy "mayoristas_empresa_erp" on public.clientes_mayoristas for all to authenticated
using (empresa_id=public.usuario_empresa_id()) with check (empresa_id=public.usuario_empresa_id());
drop policy if exists "mayorista_propio" on public.clientes_mayoristas;
create policy "mayorista_propio" on public.clientes_mayoristas for select to authenticated
using (auth_user_id=auth.uid());

drop policy if exists "precios_mayoristas_erp" on public.mayorista_producto_precios;
create policy "precios_mayoristas_erp" on public.mayorista_producto_precios for all to authenticated
using (exists(select 1 from public.clientes_mayoristas m where m.id=mayorista_id and m.empresa_id=public.usuario_empresa_id()))
with check (exists(select 1 from public.clientes_mayoristas m where m.id=mayorista_id and m.empresa_id=public.usuario_empresa_id()));

drop trigger if exists clientes_mayoristas_updated_at on public.clientes_mayoristas;
create trigger clientes_mayoristas_updated_at before update on public.clientes_mayoristas for each row execute function public.actualizar_updated_at();
drop trigger if exists mayorista_producto_precios_updated_at on public.mayorista_producto_precios;
create trigger mayorista_producto_precios_updated_at before update on public.mayorista_producto_precios for each row execute function public.actualizar_updated_at();

insert into public.modulos_erp(codigo,nombre,grupo,ruta,orden,activo)
values('mayoristas','Clientes mayoristas','Comercial','/admin/mayoristas',23,true)
on conflict(codigo) do update set nombre=excluded.nombre,grupo=excluded.grupo,ruta=excluded.ruta,orden=excluded.orden,activo=true;

insert into public.usuario_permisos(usuario_id,modulo_codigo,puede_ver,puede_crear,puede_editar,puede_eliminar)
select id,'mayoristas',true,true,true,false from public.perfiles_usuario where activo=true
on conflict(usuario_id,modulo_codigo) do update set puede_ver=true,puede_crear=true,puede_editar=true;
