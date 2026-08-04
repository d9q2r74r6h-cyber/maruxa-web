-- La tabla especial contiene Batea, Cocedor y Oficial; por eso corresponde
-- una sola versión por empresa y fecha, no una versión distinta por cargo.
delete from public.cargo_remuneraciones_especiales anterior
using public.cargo_remuneraciones_especiales conservar
where anterior.empresa_id = conservar.empresa_id
  and anterior.vigente_desde = conservar.vigente_desde
  and (
    anterior.created_at < conservar.created_at
    or (anterior.created_at = conservar.created_at and anterior.id < conservar.id)
  );

create unique index if not exists cargo_remuneraciones_especiales_empresa_vigencia_key
  on public.cargo_remuneraciones_especiales (empresa_id, vigente_desde);
