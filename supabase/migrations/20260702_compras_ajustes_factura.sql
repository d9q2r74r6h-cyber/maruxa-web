alter table public.compras
add column if not exists subtotal_productos numeric not null default 0,
add column if not exists valor_despacho numeric not null default 0,
add column if not exists impuesto_adicional numeric not null default 0,
add column if not exists descuento numeric not null default 0;

alter table public.compra_detalle
add column if not exists valor_despacho numeric not null default 0,
add column if not exists impuesto_adicional numeric not null default 0,
add column if not exists descuento numeric not null default 0;
