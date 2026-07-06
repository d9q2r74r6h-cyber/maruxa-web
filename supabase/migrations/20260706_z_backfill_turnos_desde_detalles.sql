with detalle_turnos as (
  select
    p.id as planilla_id,
    (regexp_match(d.nombre_producto, '\[turno:([0-9]+)\]'))[1]::integer as turno,
    sum(
      case
        when d.producto_id is null
          and lower(coalesce(d.nombre_producto, '')) not like 'merma%'
        then coalesce(d.kilos_total, 0)
        else 0
      end
    ) as reparto,
    sum(
      case
        when d.producto_id is not null
          and lower(coalesce(d.nombre_producto, '')) not like 'merma%'
        then coalesce(d.kilos_total, 0)
        else 0
      end
    ) as otroskg,
    sum(
      case
        when lower(coalesce(d.nombre_producto, '')) like 'merma%'
        then coalesce(d.merma, 0)
        else 0
      end
    ) as merma
  from public.planillas p
  join public.planilla_detalles d on d.planilla_id = p.id
  where d.nombre_producto ~ '\[turno:[0-9]+\]'
    and not exists (
      select 1
      from public.planilla_turnos pt
      where pt.planilla_id = p.id
    )
  group by p.id, (regexp_match(d.nombre_producto, '\[turno:([0-9]+)\]'))[1]::integer
),
valores as (
  select
    p.id as planilla_id,
    dt.turno,
    p.responsable,
    case
      when dt.turno = 1 then coalesce(p.quintal1, 0)
      when dt.turno = 2 then coalesce(p.quintal2, 0)
      else 0
    end as quintal,
    case
      when dt.turno = 1 then coalesce(p.amasado1, 0)
      when dt.turno = 2 then coalesce(p.amasado2, 0)
      else 0
    end as amasado,
    case when dt.turno = 1 then coalesce(p.masa_ocupada, 0) else 0 end as masa_ocupa,
    case when dt.turno = 1 then coalesce(p.masa_sobrante, 0) else 0 end as masa_queda,
    case when dt.turno = 1 then coalesce(p.pan_racion, 0) else 0 end as pan_racion,
    case when dt.turno = 1 then coalesce(p.pan_sobra, 0) else 0 end as pan_sobra,
    coalesce(dt.reparto, 0) as reparto,
    coalesce(dt.otroskg, 0) as otroskg,
    coalesce(dt.merma, 0) as merma,
    coalesce(dt.reparto, 0) +
      coalesce(dt.otroskg, 0) +
      coalesce(dt.merma, 0) +
      case when dt.turno = 1 then coalesce(p.pan_racion, 0) else 0 end -
      case when dt.turno = 2 then coalesce(p.pan_sobra, 0) else 0 end +
      case when dt.turno = 1 then coalesce(p.pan_sobra, 0) else 0 end as kilos
  from detalle_turnos dt
  join public.planillas p on p.id = dt.planilla_id
),
calculos as (
  select
    *,
    round(((((masa_ocupa - masa_queda) / 100) / 3) * 2)::numeric, 2) as ajuste_masa
  from valores
),
turnos_calculados as (
  select
    *,
    case
      when amasado <> trunc(amasado)
      then trunc(amasado) + ((amasado - trunc(amasado)) + ajuste_masa) * 2
      else amasado + ajuste_masa * 2
    end as factor_amasado
  from calculos
)
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
  pan_sobra,
  cacho,
  otroskg,
  centeno,
  meson,
  reparto,
  insumos,
  kilos,
  rinde
)
select
  planilla_id,
  turno,
  responsable,
  quintal,
  amasado,
  masa_ocupa,
  masa_queda,
  pan_racion,
  0,
  pan_sobra,
  0,
  otroskg,
  0,
  0,
  reparto,
  0,
  kilos,
  case
    when factor_amasado > 0 then round((kilos / factor_amasado)::numeric, 2)
    else 0
  end
from turnos_calculados;
