-- Conserva la presentación física separada del nombre comercial y de la caja.
-- Ej.: LECHE FRUTILLA / 1 LT / 12 unidades por caja.
alter table public.productos
  add column if not exists contenido_por_unidad numeric,
  add column if not exists unidad_contenido text;

alter table public.productos
  drop constraint if exists productos_contenido_por_unidad_positivo;

alter table public.productos
  add constraint productos_contenido_por_unidad_positivo
  check (contenido_por_unidad is null or contenido_por_unidad > 0);

comment on column public.productos.contenido_por_unidad is
  'Cantidad física contenida en una unidad vendible; ej. 1 para una leche de 1 LT o 155 para un yoghurt de 155 GR.';

comment on column public.productos.unidad_contenido is
  'Unidad del contenido físico por unidad vendible; ej. GR, KG, ML, LT o CC.';

with contenido_detectado as (
  select
    id,
    replace((coincidencia)[1], ',', '.')::numeric as contenido,
    case upper((coincidencia)[2])
      when 'G' then 'GR'
      when 'GRS' then 'GR'
      when 'L' then 'LT'
      else upper((coincidencia)[2])
    end as unidad
  from (
    select
      id,
      regexp_match(
        upper(nombre),
        '(?:[0-9]+\s*[X×]\s*)?([0-9]+(?:[.,][0-9]+)?)\s*(GRS|GR|G|KG|ML|CC|LT|L)\y'
      ) as coincidencia
    from public.productos
  ) coincidencias
  where coincidencia is not null
)
update public.productos as producto
set
  contenido_por_unidad = coalesce(producto.contenido_por_unidad, detectado.contenido),
  unidad_contenido = coalesce(producto.unidad_contenido, detectado.unidad)
from contenido_detectado as detectado
where producto.id = detectado.id;
