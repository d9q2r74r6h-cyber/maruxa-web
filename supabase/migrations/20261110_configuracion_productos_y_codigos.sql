-- Tipos y unidades visibles en Productos. Los códigos de tipo existentes se preservan
-- para no afectar recetas, stock ni historial; sólo se configuran nombre y disponibilidad.
create table if not exists public.configuraciones_productos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  grupo text not null check (grupo in ('tipo', 'unidad')),
  codigo text not null check (
    (grupo = 'tipo' and codigo in ('producto', 'ingrediente', 'envase', 'mano_obra'))
    or (grupo = 'unidad' and codigo = upper(btrim(codigo)) and codigo ~ '^[A-Z0-9_]+$')
  ),
  nombre text not null check (btrim(nombre) <> ''),
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, grupo, codigo)
);

create index if not exists configuraciones_productos_empresa_grupo_orden_idx
  on public.configuraciones_productos (empresa_id, grupo, orden, nombre);

alter table public.configuraciones_productos enable row level security;

drop policy if exists configuraciones_productos_empresa on public.configuraciones_productos;
create policy configuraciones_productos_empresa
on public.configuraciones_productos
for all
to authenticated
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

insert into public.configuraciones_productos (empresa_id, grupo, codigo, nombre, orden, activo)
select empresa.id, semilla.grupo, semilla.codigo, semilla.nombre, semilla.orden, true
from public.empresas as empresa
cross join (
  values
    ('tipo', 'producto', 'Producto terminado', 10),
    ('tipo', 'ingrediente', 'Materia prima', 20),
    ('tipo', 'envase', 'Insumo', 30),
    ('tipo', 'mano_obra', 'Mano de obra', 40),
    ('unidad', 'UN', 'UND', 10),
    ('unidad', 'GR', 'GRS', 20),
    ('unidad', 'ML', 'ML', 30),
    ('unidad', 'KG', 'KG', 40),
    ('unidad', 'LT', 'LT', 50),
    ('unidad', 'CC', 'CC', 60),
    ('unidad', 'MIN', 'MIN', 70)
) as semilla(grupo, codigo, nombre, orden)
on conflict (empresa_id, grupo, codigo) do nothing;

-- Cambia un código de producto dentro de la empresa actual y rechaza duplicados.
-- Úsala desde la aplicación en lugar de actualizar el código directamente.
create or replace function public.cambiar_codigo_producto(
  p_producto_id bigint,
  p_codigo_nuevo text
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_empresa_id uuid := public.usuario_empresa_id();
  v_codigo text := upper(btrim(coalesce(p_codigo_nuevo, '')));
begin
  if v_empresa_id is null then
    raise exception 'No se pudo identificar la empresa.';
  end if;
  if v_codigo = '' then
    raise exception 'El código del producto no puede quedar vacío.';
  end if;
  if length(v_codigo) > 80 then
    raise exception 'El código del producto no puede superar 80 caracteres.';
  end if;

  perform 1 from public.productos
  where id = p_producto_id and empresa_id = v_empresa_id
  for update;
  if not found then
    raise exception 'No tienes acceso a este producto.';
  end if;

  if exists (
    select 1 from public.productos
    where empresa_id = v_empresa_id
      and id <> p_producto_id
      and upper(btrim(coalesce(codigo, ''))) = v_codigo
  ) then
    raise exception 'Ya existe otro producto con el código %.', v_codigo;
  end if;

  update public.productos
  set codigo = v_codigo
  where id = p_producto_id and empresa_id = v_empresa_id;

  return v_codigo;
end;
$$;

grant execute on function public.cambiar_codigo_producto(bigint, text) to authenticated;
