alter table public.funcionarios
  add column if not exists ultimo_aviso_previo_cumpleanos integer;

comment on column public.funcionarios.ultimo_aviso_previo_cumpleanos is
  'Año del cumpleaños para el cual ya se envió el aviso al equipo el día anterior.';
