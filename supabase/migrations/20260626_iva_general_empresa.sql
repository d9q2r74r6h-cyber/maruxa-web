alter table public.empresas
add column if not exists iva_porcentaje numeric not null default 19;

update public.empresas
set iva_porcentaje = 19
where iva_porcentaje is null;
