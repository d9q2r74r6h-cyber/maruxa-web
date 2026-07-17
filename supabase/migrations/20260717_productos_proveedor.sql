alter table public.productos
  add column if not exists proveedor_id uuid
  references public.proveedores(id) on delete set null;

create index if not exists productos_proveedor_id_idx
  on public.productos(proveedor_id);

comment on column public.productos.proveedor_id is
  'Proveedor principal asociado al producto.';
