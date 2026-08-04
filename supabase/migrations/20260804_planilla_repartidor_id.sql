alter table public.planilla_detalles
  add column if not exists repartidor_id uuid references public.funcionarios(id) on delete set null;

create index if not exists planilla_detalles_repartidor_idx
  on public.planilla_detalles (repartidor_id);

-- Vincula detalles históricos cuando la referencia guardada coincide con una
-- palabra del nombre actual de un único funcionario repartidor de la empresa.
with candidatos as (
  select d.id detalle_id, min(f.id::text)::uuid repartidor_id
  from public.planilla_detalles d
  join public.planillas p on p.id = d.planilla_id
  join public.funcionarios f on f.empresa_id = p.empresa_id
  where d.repartidor_id is null
    and d.producto_id is null
    and lower(d.nombre_producto) not like 'merma%'
    and exists (
      select 1 from unnest(regexp_split_to_array(lower(f.nombre_completo), '\s+')) palabra
      where length(palabra) >= 3
        and lower(d.nombre_producto) ~ ('(^|[^a-záéíóúñ])' || palabra || '([^a-záéíóúñ]|$)')
    )
  group by d.id
  having count(distinct f.id) = 1
)
update public.planilla_detalles d
set repartidor_id = c.repartidor_id
from candidatos c
where d.id = c.detalle_id;
