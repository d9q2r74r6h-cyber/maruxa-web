alter table public.planilla_turnos
add column if not exists panaderos integer not null default 0;
