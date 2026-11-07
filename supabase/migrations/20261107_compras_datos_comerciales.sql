alter table public.compras
  add column if not exists tipo_documento text not null default 'factura',
  add column if not exists fecha_vencimiento date,
  add column if not exists condicion_pago text,
  add column if not exists orden_compra text,
  add column if not exists referencia text,
  add column if not exists observaciones text;

comment on column public.compras.tipo_documento is 'Tipo de documento de compra: factura, exenta, nota de crédito, guía u otro.';
comment on column public.compras.fecha_vencimiento is 'Fecha comprometida de pago para compras a crédito.';
comment on column public.compras.condicion_pago is 'Condición comercial de pago elegida al registrar la compra.';
