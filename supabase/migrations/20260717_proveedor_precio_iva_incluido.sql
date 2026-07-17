alter table public.proveedores
  add column if not exists precio_iva_incluido boolean not null default true;

comment on column public.proveedores.precio_iva_incluido is
  'Indica si los precios ingresados en Compras incluyen IVA.';
