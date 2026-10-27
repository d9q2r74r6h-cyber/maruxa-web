alter table public.producto_precios_whatsapp
  add column if not exists presentaciones jsonb not null default '[]'::jsonb;

update public.producto_precios_whatsapp pw
set presentaciones = coalesce((
  select jsonb_agg(jsonb_build_object(
    'id', opcion->>'id',
    'nombre', opcion->>'nombre',
    'precio', 0,
    'activo', coalesce((opcion->>'activo')::boolean, true)
  ))
  from jsonb_array_elements(coalesce(p.presentaciones, '[]'::jsonb)) opcion
), '[]'::jsonb)
from public.productos p
where pw.producto_id = p.id
  and pw.canal = '5041'
  and jsonb_array_length(coalesce(pw.presentaciones, '[]'::jsonb)) = 0;

