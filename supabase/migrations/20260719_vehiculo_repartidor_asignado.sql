alter table public.vehiculos_reparto
  add column if not exists repartidor_id uuid
  references public.funcionarios(id) on delete set null;

create unique index if not exists vehiculos_reparto_repartidor_activo_key
  on public.vehiculos_reparto (empresa_id, repartidor_id)
  where activo = true and repartidor_id is not null;

update public.vehiculos_reparto v
set repartidor_id = f.id
from public.funcionarios f
where f.empresa_id = v.empresa_id
  and f.activo = true
  and lower(f.cargo) = 'repartidor'
  and (
    (v.codigo = 'RANTUL' and lower(f.nombre_completo) = 'luis rantul')
    or (v.codigo = 'ALBORNOZ' and lower(f.nombre_completo) = 'luis albornoz')
  )
  and v.repartidor_id is null;
