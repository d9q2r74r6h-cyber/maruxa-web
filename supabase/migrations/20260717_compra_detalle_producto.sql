alter table public.compra_detalle
  add column if not exists producto_id bigint
  references public.productos(id) on delete restrict;

create index if not exists compra_detalle_producto_id_idx
  on public.compra_detalle(producto_id);

comment on column public.compra_detalle.producto_id is
  'Producto comprado. Se mantiene separado de ingredientes e insumos.';
