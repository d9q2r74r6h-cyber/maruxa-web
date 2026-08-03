alter table public.cargos_empresa
  add column if not exists modalidad_pago text not null default 'mensual'
    check (modalidad_pago in ('diaria', 'mensual', 'panadero')),
  add column if not exists remuneracion numeric(14,2) not null default 0,
  add column if not exists configuracion_pago jsonb not null default '{}'::jsonb;

update public.cargos_empresa
set modalidad_pago = 'panadero',
    configuracion_pago = jsonb_build_object(
      'normal', jsonb_build_object(
        'casa', jsonb_build_object('batea',26800,'cocedor',25700,'oficial',22500),
        'externo', jsonb_build_object('batea',31300,'cocedor',29000,'oficial',26000)
      ),
      'festivo', jsonb_build_object(
        'casa', jsonb_build_object('batea',36600,'cocedor',35000,'oficial',30000),
        'externo', jsonb_build_object('batea',43400,'cocedor',41400,'oficial',35400)
      ),
      'demasia_normal_qq', 8000,
      'demasia_festivo_qq', 12000
    )
where lower(nombre) like '%panadero%'
  and configuracion_pago = '{}'::jsonb;
