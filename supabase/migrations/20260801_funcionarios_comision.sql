alter table public.funcionarios
  add column if not exists trabaja_comision boolean not null default false,
  add column if not exists porcentaje_comision numeric not null default 3;

comment on column public.funcionarios.trabaja_comision is
  'Indica si el funcionario recibe liquidacion calculada por comision.';

comment on column public.funcionarios.porcentaje_comision is
  'Porcentaje aplicado sobre el total entregado del reparto.';
