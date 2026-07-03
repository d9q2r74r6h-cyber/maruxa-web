alter table public.funcionarios
add column if not exists fecha_nacimiento date,
add column if not exists ultimo_saludo_cumpleanos integer;
