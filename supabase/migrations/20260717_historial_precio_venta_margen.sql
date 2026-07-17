alter table public.producto_costos_historial
  add column if not exists margen_porcentaje numeric,
  add column if not exists precio_venta numeric;

comment on column public.producto_costos_historial.margen_porcentaje is
  'Margen usado cuando se registró el costo.';

comment on column public.producto_costos_historial.precio_venta is
  'Precio de venta asignado cuando se registró el costo.';
