with detalle_turnos as (
  select
    d.planilla_id,
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
  from public.planilla_detalles d
  where d.nombre_producto ~ '\[turno:[0-9]+\]'
  group by d.planilla_id, (regexp_match(d.nombre_producto, '\[turno:([0-9]+)\]'))[1]::integer
),
valores as (
  select
    pt.id,
    pt.planilla_id,
    pt.turno,
    coalesce(pt.pan_racion, 0) as pan_racion,
    coalesce(dt.otroskg, pt.otroskg, 0) as otroskg,
    coalesce(dt.reparto, pt.reparto, 0) as reparto,
    coalesce(dt.merma, 0) as merma,
    coalesce(pt.cacho, 0) as cacho,
    coalesce(previo.pan_sobra, 0) as pan_sobra_anterior,
    coalesce(pt.amasado, 0) as amasado,
    coalesce(pt.masa_ocupa, 0) as masa_ocupa,
    coalesce(pt.masa_queda, 0) as masa_queda
  from public.planilla_turnos pt
  left join detalle_turnos dt
    on dt.planilla_id = pt.planilla_id
   and dt.turno = pt.turno
  left join public.planilla_turnos previo
    on previo.planilla_id = pt.planilla_id
   and previo.turno = pt.turno - 1
),
calculos as (
  select
    *,
    reparto + otroskg + pan_racion + merma - cacho - pan_sobra_anterior as kilos_corregidos,
    round(((((masa_ocupa - masa_queda) / 100) / 3) * 2)::numeric, 2) as ajuste_masa
  from valores
),
turnos_corregidos as (
  select
    *,
    case
      when amasado <> trunc(amasado)
      then trunc(amasado) + ((amasado - trunc(amasado)) + ajuste_masa) * 2
      else amasado + ajuste_masa * 2
    end as factor_amasado
  from calculos
),
actualizados as (
  update public.planilla_turnos pt
  set
    reparto = round(tc.reparto::numeric, 2),
    otroskg = round(tc.otroskg::numeric, 2),
    kilos = round(tc.kilos_corregidos::numeric, 2),
    rinde = case
      when tc.factor_amasado > 0
      then round((tc.kilos_corregidos / tc.factor_amasado)::numeric, 2)
      else 0
    end
  from turnos_corregidos tc
  where tc.id = pt.id
  returning pt.planilla_id
),
resumen as (
  select
    pt.planilla_id,
    sum(coalesce(pt.kilos, 0)) as kilos_total,
    sum(
      case
        when coalesce(pt.rinde, 0) > 0 then coalesce(pt.kilos, 0) / pt.rinde
        else 0
      end
    ) as factor_total
  from public.planilla_turnos pt
  where pt.planilla_id in (select distinct planilla_id from actualizados)
  group by pt.planilla_id
)
update public.planillas p
set
  kilos_producidos = round(resumen.kilos_total::numeric, 2),
  rinde = case
    when resumen.factor_total > 0
    then round((resumen.kilos_total / resumen.factor_total)::numeric, 2)
    else 0
  end,
  rinde_por_saco = case
    when resumen.factor_total > 0
    then round((resumen.kilos_total / resumen.factor_total)::numeric, 2)
    else 0
  end
from resumen
where resumen.planilla_id = p.id;
