insert into public.planilla_detalles (
  planilla_id,
  producto_id,
  nombre_producto,
  cantidad,
  peso_unitario,
  kilos_total,
  merma
)
select
  pt.planilla_id,
  null,
  'MESON - Turno ' || pt.turno || ' [turno:' || pt.turno || ']',
  1,
  coalesce(pt.pan_meson, 0),
  coalesce(pt.pan_meson, 0),
  0
from public.planilla_turnos pt
where coalesce(pt.pan_meson, 0) > 0
  and not exists (
    select 1
    from public.planilla_detalles d
    where d.planilla_id = pt.planilla_id
      and lower(coalesce(d.nombre_producto, '')) like 'meson%'
      and d.nombre_producto like ('%[turno:' || pt.turno || ']%')
  );

insert into public.planilla_detalles (
  planilla_id,
  producto_id,
  nombre_producto,
  cantidad,
  peso_unitario,
  kilos_total,
  merma
)
select
  p.id,
  null,
  'MESON - Turno 1 [turno:1]',
  1,
  coalesce(p.pan_meson, 0),
  coalesce(p.pan_meson, 0),
  0
from public.planillas p
where coalesce(p.pan_meson, 0) > 0
  and not exists (
    select 1
    from public.planilla_turnos pt
    where pt.planilla_id = p.id
  )
  and not exists (
    select 1
    from public.planilla_detalles d
    where d.planilla_id = p.id
      and lower(coalesce(d.nombre_producto, '')) like 'meson%'
  );

update public.planilla_turnos pt
set
  reparto = coalesce((
    select sum(coalesce(d.kilos_total, 0))
    from public.planilla_detalles d
    where d.planilla_id = pt.planilla_id
      and lower(coalesce(d.nombre_producto, '')) not like 'merma%'
      and d.nombre_producto like ('%[turno:' || pt.turno || ']%')
  ), 0),
  pan_meson = 0
where coalesce(pt.pan_meson, 0) > 0;

update public.planillas p
set pan_meson = 0
where coalesce(p.pan_meson, 0) > 0;
