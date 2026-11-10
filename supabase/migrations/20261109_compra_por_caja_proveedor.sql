-- Define si la presentación habitual facturada por este proveedor corresponde
-- a una caja del producto, para reutilizar la conversión en futuras facturas.
alter table public.productos_proveedor
  add column if not exists compra_por_caja boolean not null default false;

comment on column public.productos_proveedor.compra_por_caja is
  'Indica que el precio y cantidad de factura del proveedor vienen por caja.';
