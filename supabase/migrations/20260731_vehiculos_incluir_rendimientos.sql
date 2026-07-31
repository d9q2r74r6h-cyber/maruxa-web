alter table public.vehiculos_reparto
  add column if not exists incluir_en_rendimientos boolean not null default true;

comment on column public.vehiculos_reparto.incluir_en_rendimientos is
  'Indica si el vehiculo aparece en el informe y planilla de rendimiento.';
