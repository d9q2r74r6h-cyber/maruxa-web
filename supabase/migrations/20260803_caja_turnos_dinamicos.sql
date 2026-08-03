alter table public.caja_cierres
  add column if not exists turnos_panaderos jsonb not null default '[]'::jsonb;

update public.caja_cierres
set turnos_panaderos = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid(),
    'nombre', '1° turno',
    'lineas', panaderos_primer_turno
  ),
  jsonb_build_object(
    'id', gen_random_uuid(),
    'nombre', '2° turno',
    'lineas', panaderos_segundo_turno
  )
)
where turnos_panaderos = '[]'::jsonb;
