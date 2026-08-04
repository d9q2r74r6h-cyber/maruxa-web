alter table public.funcionarios
  add column if not exists recibe_dominical boolean not null default false,
  add column if not exists ciclo_dominical text;

alter table public.funcionarios drop constraint if exists funcionarios_ciclo_dominical_check;
alter table public.funcionarios add constraint funcionarios_ciclo_dominical_check
  check (ciclo_dominical is null or ciclo_dominical in ('impar', 'par'));

comment on column public.funcionarios.recibe_dominical is 'Indica si recibe un sueldo base adicional en el penúltimo domingo de su ciclo.';
comment on column public.funcionarios.ciclo_dominical is 'Meses impares o pares en que trabaja los dos últimos domingos.';
