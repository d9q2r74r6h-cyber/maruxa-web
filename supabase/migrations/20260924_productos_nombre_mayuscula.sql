-- Normaliza los nombres actuales y garantiza mayúsculas en toda escritura futura.
update public.productos
set nombre = upper(btrim(nombre))
where nombre is distinct from upper(btrim(nombre));

create or replace function public.normalizar_nombre_producto_mayuscula()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nombre := upper(btrim(new.nombre));
  return new;
end;
$$;

drop trigger if exists productos_nombre_mayuscula on public.productos;
create trigger productos_nombre_mayuscula
before insert or update of nombre on public.productos
for each row
execute function public.normalizar_nombre_producto_mayuscula();