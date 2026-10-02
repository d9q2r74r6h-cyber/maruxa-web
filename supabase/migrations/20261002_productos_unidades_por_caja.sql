-- Separa la cantidad del envase del nombre comercial del producto.
alter table public.productos
  add column if not exists undxcaja integer;

alter table public.productos
  drop constraint if exists productos_undxcaja_positiva;

alter table public.productos
  add constraint productos_undxcaja_positiva
  check (undxcaja is null or undxcaja > 0);

with productos_con_unidades as (
  select
    id,
    ((regexp_match(
      nombre,
      '\(\s*([0-9]+)\s*(u|un|und|unds|unid|unidad|unidades)?\s*(por\s+caja)?\s*\)\s*$',
      'i'
    ))[1])::integer as unidades,
    btrim(regexp_replace(
      nombre,
      '\s*\(\s*[0-9]+\s*(u|un|und|unds|unid|unidad|unidades)?\s*(por\s+caja)?\s*\)\s*$',
      '',
      'i'
    )) as nombre_limpio
  from public.productos
  where nombre ~* '\(\s*[0-9]+\s*(u|un|und|unds|unid|unidad|unidades)?\s*(por\s+caja)?\s*\)\s*$'
)
update public.productos as producto
set
  undxcaja = coalesce(producto.undxcaja, detectado.unidades),
  nombre = upper(detectado.nombre_limpio)
from productos_con_unidades as detectado
where producto.id = detectado.id;

create or replace function public.normalizar_nombre_producto_mayuscula()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  unidades_detectadas integer;
  patron_caja constant text := '\s*\(\s*([0-9]+)\s*(u|un|und|unds|unid|unidad|unidades)?\s*(por\s+caja)?\s*\)\s*$';
begin
  unidades_detectadas := ((regexp_match(new.nombre, patron_caja, 'i'))[1])::integer;

  if (new.undxcaja is null or new.undxcaja <= 0) and unidades_detectadas is not null then
    new.undxcaja := unidades_detectadas;
  end if;

  new.nombre := upper(btrim(regexp_replace(new.nombre, patron_caja, '', 'i')));
  return new;
end;
$$;

drop trigger if exists productos_nombre_mayuscula on public.productos;
create trigger productos_nombre_mayuscula
before insert or update of nombre, undxcaja on public.productos
for each row
execute function public.normalizar_nombre_producto_mayuscula();

comment on column public.productos.undxcaja is
  'Cantidad de unidades contenidas en una caja; se guarda separada del nombre comercial.';
