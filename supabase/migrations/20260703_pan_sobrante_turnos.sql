alter table public.planilla_turnos
add column if not exists pan_sobra numeric not null default 0;
