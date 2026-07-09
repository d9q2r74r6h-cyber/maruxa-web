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
        and pt.turno = (regexp_match(d.nombre_producto, '\[turno:([0-9]+)\]'))[1]::integer
    )
  group by p.id, (regexp_match(d.nombre_producto, '\[turno:([0-9]+)\]'))[1]::integer
),
valores as (
  select
    p.id as planilla_id,
    dt.turno,
    p.responsable,
    exists (
      select 1
      from public.planilla_turnos pt
      where pt.planilla_id = p.id
        and pt.turno = 2
    ) or coalesce(p.quintal2, 0) > 0 or coalesce(p.amasado2, 0) > 0 as usa_segundo_turno,
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
    coalesce(dt.reparto, 0) as reparto,
    coalesce(dt.otroskg, 0) as otroskg,
    coalesce(dt.merma, 0) as merma,
    coalesce(previo.pan_sobra, case when dt.turno = 2 then p.pan_sobra else 0 end, 0) as pan_sobra_anterior,
    p.masa_ocupada,
    p.masa_sobrante,
    p.pan_racion,
    p.pan_sobra,
    p.cacho
  from detalle_turnos dt
  join public.planillas p on p.id = dt.planilla_id
  left join public.planilla_turnos previo
    on previo.planilla_id = p.id
   and previo.turno = dt.turno - 1
),
turnos_base as (
  select
    *,
    case when turno = 2 or not usa_segundo_turno then coalesce(masa_ocupada, 0) else 0 end as masa_ocupa_turno,
    case when turno = 2 or not usa_segundo_turno then coalesce(masa_sobrante, 0) else 0 end as masa_queda_turno,
    case when turno = 2 or not usa_segundo_turno then coalesce(pan_racion, 0) else 0 end as pan_racion_turno,
    case when turno = 2 or not usa_segundo_turno then coalesce(pan_sobra, 0) else 0 end as pan_sobra_turno,
    case when turno = 2 or not usa_segundo_turno then coalesce(cacho, 0) else 0 end as cacho_turno
  from valores
),
calculos as (
  select
    *,
    reparto + otroskg + merma + pan_racion_turno - cacho_turno - pan_sobra_anterior as kilos,
    round(((((masa_ocupa_turno - masa_queda_turno) / 100) / 3) * 2)::numeric, 2) as ajuste_masa
  from turnos_base
),
insertados as (
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
    masa_ocupa_turno,
    masa_queda_turno,
    pan_racion_turno,
    0,
    pan_sobra_turno,
    cacho_turno,
    otroskg,
    0,
    0,
    reparto,
    0,
    round(kilos::numeric, 2),
    case
      when (
        case
          when amasado <> trunc(amasado)
          then trunc(amasado) + ((amasado - trunc(amasado)) + ajuste_masa) * 2
          else amasado + ajuste_masa * 2
        end
      ) > 0
      then round((
        kilos /
        case
          when amasado <> trunc(amasado)
          then trunc(amasado) + ((amasado - trunc(amasado)) + ajuste_masa) * 2
          else amasado + ajuste_masa * 2
        end
      )::numeric, 2)
      else 0
    end
  from calculos
  returning planilla_id
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
  where pt.planilla_id in (select distinct planilla_id from insertados)
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
