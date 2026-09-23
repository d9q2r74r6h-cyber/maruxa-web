-- Aplicar antes de desplegar el código de presentaciones.
-- Los campos históricos y los pedidos existentes permanecen intactos.
begin;
alter table public.productos add column if not exists presentaciones jsonb;

create or replace function public.presentaciones_producto_validas(valor jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare opcion jsonb; ids text[] := '{}'; nombres text[] := '{}'; nombre text;
begin
  if valor is null then return true; end if;
  if jsonb_typeof(valor) <> 'array' then return false; end if;
  for opcion in select * from jsonb_array_elements(valor) loop
    if jsonb_typeof(opcion) <> 'object'
      or jsonb_typeof(opcion->'id') is distinct from 'string'
      or coalesce(length(opcion->>'id'), 0) = 0
      or jsonb_typeof(opcion->'nombre') is distinct from 'string'
      or jsonb_typeof(opcion->'precio') is distinct from 'number'
      or jsonb_typeof(opcion->'activo') is distinct from 'boolean' then return false; end if;
    nombre := lower(btrim(opcion->>'nombre'));
    if length(nombre) < 1 or length(nombre) > 80 or nombre = any(nombres)
      or (opcion->>'id') = any(ids) or (opcion->>'precio')::numeric <= 0
      or (opcion->>'precio')::numeric <> trunc((opcion->>'precio')::numeric)
      or (opcion->>'precio')::numeric > 9007199254740991 then return false; end if;
    ids := array_append(ids, opcion->>'id'); nombres := array_append(nombres, nombre);
  end loop;
  return true;
end; $$;
alter table public.productos drop constraint if exists productos_presentaciones_validas;
alter table public.productos add constraint productos_presentaciones_validas
check (public.presentaciones_producto_validas(presentaciones));

-- Migrar solo opciones con precios existentes; null permite leer datos heredados.
update public.productos p
set presentaciones = (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', 'legacy-' || v.personas, 'nombre', v.personas || ' personas',
    'precio', v.precio, 'activo', true) order by v.personas), '[]'::jsonb)
  from (values (10,p.precio_10),(15,p.precio_15),(20,p.precio_20),(25,p.precio_25)) v(personas,precio)
  where v.precio > 0
)
where p.presentaciones is null
and (p.precio_10 > 0 or p.precio_15 > 0 or p.precio_20 > 0 or p.precio_25 > 0);
-- El listado público filtra por precio positivo; usar el menor precio disponible.
update public.productos p set precio = (
  select min((opcion->>'precio')::numeric)
  from jsonb_array_elements(p.presentaciones) opcion where (opcion->>'activo')::boolean
) where p.presentaciones is not null and jsonb_array_length(p.presentaciones) > 0;
commit;
