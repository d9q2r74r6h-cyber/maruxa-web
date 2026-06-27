-- Permite decidir desde la familia si sus productos aparecen en el catalogo publico.

alter table public.familias_productos
add column if not exists mostrar_catalogo boolean not null default true;

comment on column public.familias_productos.mostrar_catalogo
is 'Indica si los productos asociados a esta familia se muestran en el catalogo publico y feeds externos.';

alter table public.familias_productos enable row level security;

drop policy if exists "familias_productos_catalogo_publico" on public.familias_productos;
create policy "familias_productos_catalogo_publico"
on public.familias_productos
for select
to anon
using (
  activo = true
  and mostrar_catalogo = true
);

drop policy if exists "familias_productos_erp_autenticado" on public.familias_productos;
create policy "familias_productos_erp_autenticado"
on public.familias_productos
for all
to authenticated
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

drop policy if exists "productos_catalogo_publico" on public.productos;
create policy "productos_catalogo_publico"
on public.productos
for select
to anon
using (
  activo = true
  and tipo_producto = 'producto'
  and exists (
    select 1
    from public.familias_productos familia
    where familia.id = productos.familia_id
      and familia.activo = true
      and familia.mostrar_catalogo = true
  )
);

grant select (
  id,
  empresa_id,
  nombre,
  activo,
  mostrar_catalogo
) on public.familias_productos to anon;
