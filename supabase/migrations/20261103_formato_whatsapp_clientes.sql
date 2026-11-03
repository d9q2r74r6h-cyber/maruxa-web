-- Normaliza únicamente números móviles chilenos de clientes.
-- Formato final: +56 9 XXXX XXXX
with telefonos as (
  select
    id,
    regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g') as digitos
  from public.clientes
  where telefono is not null
    and btrim(telefono) <> ''
),
moviles_chilenos as (
  select
    id,
    case
      when length(digitos) = 11 and left(digitos, 3) = '569'
        then substr(digitos, 3, 9)
      when length(digitos) = 9 and left(digitos, 1) = '9'
        then digitos
      when length(digitos) = 8
        then '9' || digitos
      else null
    end as numero_nacional
  from telefonos
)
update public.clientes as cliente
set telefono = '+56 9 '
  || substr(movil.numero_nacional, 2, 4)
  || ' '
  || substr(movil.numero_nacional, 6, 4)
from moviles_chilenos as movil
where cliente.id = movil.id
  and movil.numero_nacional is not null
  and length(movil.numero_nacional) = 9
  and left(movil.numero_nacional, 1) = '9'
  and cliente.telefono is distinct from (
    '+56 9 '
    || substr(movil.numero_nacional, 2, 4)
    || ' '
    || substr(movil.numero_nacional, 6, 4)
  );
