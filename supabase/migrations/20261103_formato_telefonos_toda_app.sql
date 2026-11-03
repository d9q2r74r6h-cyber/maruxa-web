-- Unifica los teléfonos chilenos usados por la aplicación.
-- Formato final: +56 9 9842 8324 (también admite líneas chilenas no móviles).
create function pg_temp.formatear_telefono_chile(valor text)
returns text
language plpgsql
as $$
declare
  original text := btrim(coalesce(valor, ''));
  digitos text;
begin
  if original = '' then return original; end if;
  if left(original, 1) = '+' and regexp_replace(original, '\s', '', 'g') not like '+56%' then
    return original;
  end if;

  digitos := regexp_replace(original, '[^0-9]', '', 'g');
  if left(digitos, 2) = '56' then digitos := substr(digitos, 3); end if;
  if left(digitos, 1) = '0' then digitos := substr(digitos, 2); end if;
  if length(digitos) = 8 then digitos := '9' || digitos; end if;
  if length(digitos) <> 9 then return original; end if;

  return '+56 ' || substr(digitos, 1, 1) || ' '
    || substr(digitos, 2, 4) || ' ' || substr(digitos, 6, 4);
end;
$$;

do $$
declare
  destino record;
begin
  for destino in
    select * from (values
      ('clientes', 'telefono'),
      ('funcionarios', 'telefono'),
      ('proveedores', 'telefono'),
      ('proveedores', 'contacto_telefono'),
      ('clientes_mayoristas', 'telefono'),
      ('empresas', 'telefono'),
      ('empresas', 'whatsapp'),
      ('perfiles_usuario', 'notificacion_whatsapp'),
      ('pedidos', 'telefono')
    ) as columnas(tabla, columna)
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = destino.tabla
        and column_name = destino.columna
    ) then
      execute format(
        'update public.%I set %I = pg_temp.formatear_telefono_chile(%I) where %I is not null and btrim(%I) <> '''' and %I is distinct from pg_temp.formatear_telefono_chile(%I)',
        destino.tabla, destino.columna, destino.columna, destino.columna,
        destino.columna, destino.columna, destino.columna
      );
    end if;
  end loop;
end;
$$;
