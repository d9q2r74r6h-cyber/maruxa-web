-- Lectura publica minima para el catalogo web.
-- No expone costos, stock ni productos de uso interno.

alter table public.empresas enable row level security;
alter table public.productos enable row level security;

drop policy if exists "empresas_catalogo_publico" on public.empresas;
create policy "empresas_catalogo_publico"
on public.empresas
for select
to anon
using (activo = true);

drop policy if exists "empresas_erp_autenticado" on public.empresas;
create policy "empresas_erp_autenticado"
on public.empresas
for all
to authenticated
using (id = public.usuario_empresa_id())
with check (id = public.usuario_empresa_id());

drop policy if exists "productos_catalogo_publico" on public.productos;
create policy "productos_catalogo_publico"
on public.productos
for select
to anon
using (
  activo = true
  and tipo_producto = 'producto'
);

drop policy if exists "productos_erp_autenticado" on public.productos;
create policy "productos_erp_autenticado"
on public.productos
for all
to authenticated
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

revoke select on public.productos from anon;
grant select (
  id,
  empresa_id,
  nombre,
  descripcion,
  precio,
  categoria,
  imagen,
  destacado,
  slug,
  precio_10,
  precio_15,
  precio_20,
  precio_25,
  tipo_producto,
  activo
) on public.productos to anon;
