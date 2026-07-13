alter table public.productos
  add column if not exists mostrar_en_planilla_rinde boolean not null default false;

comment on column public.productos.mostrar_en_planilla_rinde is
  'Muestra el ingrediente en la segunda franja de insumos de la planilla de rinde.';
