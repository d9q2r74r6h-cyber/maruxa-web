insert into public.planilla_turnos (
  planilla_id,
  turno,
  responsable,
  quintal,
  amasado,
  masa_ocupa,
  masa_queda,
  pan_racion,
  pan_meson,
  cacho,
  otroskg,
  centeno,
  meson,
  reparto,
  insumos,
  kilos,
  rinde,
  pan_sobra
)
select
  p.id,
  case
    when lower(coalesce(p.turno, '')) like '%2%' then 2
    else 1
  end as turno,
  p.responsable,
  case
    when lower(coalesce(p.turno, '')) like '%2%' then coalesce(p.quintal2, 0)
    else coalesce(p.quintal1, 0)
  end as quintal,
  case
    when lower(coalesce(p.turno, '')) like '%2%' then coalesce(p.amasado2, 0)
    else coalesce(p.amasado1, 0)
  end as amasado,
  coalesce(p.masa_ocupada, 0),
  coalesce(p.masa_sobrante, 0),
  coalesce(p.pan_racion, 0),
  coalesce(p.pan_meson, 0),
  coalesce(p.cacho, 0),
  0,
  coalesce(p.centeno, 0),
  coalesce(p.meson, 0),
  coalesce((
    select sum(d.kilos_total)
    from public.planilla_detalles d
    where d.planilla_id = p.id
      and lower(coalesce(d.nombre_producto, '')) not like 'merma%'
  ), 0),
  0,
  coalesce(p.kilos_producidos, 0),
  coalesce(p.rinde_por_saco, p.rinde, 0),
  coalesce(p.pan_sobra, 0)
from public.planillas p
where not exists (
  select 1
  from public.planilla_turnos pt
  where pt.planilla_id = p.id
);
