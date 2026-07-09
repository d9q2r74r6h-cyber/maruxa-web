with valores as (
  select
    pt.id,
    pt.planilla_id,
    pt.turno,
    coalesce(pt.pan_racion, 0) as pan_racion,
    coalesce(pt.otroskg, 0) as otroskg,
    coalesce(pt.reparto, 0) as reparto,
    coalesce(pt.pan_sobra, 0) as pan_sobra,
    coalesce(previo.pan_sobra, 0) as pan_sobra_anterior,
    coalesce((
      select sum(coalesce(d.merma, 0))
      from public.planilla_detalles d
      where d.planilla_id = pt.planilla_id
        and lower(coalesce(d.nombre_producto, '')) like 'merma%'
        and d.nombre_producto like ('%[turno:' || pt.turno || ']%')
    ), 0) as merma,
    coalesce(pt.amasado, 0) as amasado,
    coalesce(pt.masa_ocupa, 0) as masa_ocupa,
    coalesce(pt.masa_queda, 0) as masa_queda
  from public.planilla_turnos pt
  left join public.planilla_turnos previo
    on previo.planilla_id = pt.planilla_id
   and previo.turno = pt.turno - 1
),
calculos as (
  select
    *,
    reparto + otroskg + pan_racion + merma - pan_sobra_anterior as kilos_corregidos,
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
