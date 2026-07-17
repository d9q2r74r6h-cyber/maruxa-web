alter table public.compra_detalle
  alter column ingrediente_id drop not null;

comment on column public.compra_detalle.ingrediente_id is
  'Ingrediente comprado. Es opcional cuando la fila referencia directamente un producto.';
