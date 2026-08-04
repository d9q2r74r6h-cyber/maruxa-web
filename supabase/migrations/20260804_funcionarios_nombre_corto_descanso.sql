alter table public.funcionarios
  add column if not exists nombre_corto text,
  add column if not exists dia_descanso text
    check (dia_descanso is null or dia_descanso in ('lunes','martes','miércoles','jueves','viernes','sábado','domingo'));

update public.funcionarios
set nombre_corto = split_part(trim(nombre_completo), ' ', 1)
where trim(coalesce(nombre_corto, '')) = '';

comment on column public.funcionarios.nombre_corto is 'Nombre breve utilizado en grillas y selectores.';
comment on column public.funcionarios.dia_descanso is 'Día habitual de descanso semanal del funcionario.';
