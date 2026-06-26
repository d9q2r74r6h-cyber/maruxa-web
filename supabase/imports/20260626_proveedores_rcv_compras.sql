do $$
declare
  v_empresa uuid;
begin
  select id
    into v_empresa
  from public.empresas
  where slug = 'maruxa'
  limit 1;

  if v_empresa is null then
    raise exception 'No se encontro la empresa con slug maruxa.';
  end if;

  insert into public.proveedores (
    empresa_id,
    rut,
    razon_social,
    activo
  )
  values
    (v_empresa, '79984240-8', 'AGROSUPER COMERCIALIZADORA DE ALIMENTOS LTDA.', true),
    (v_empresa, '96880700-5', 'ALIMENTOS Y CECINAS KASSEL S.A.', true),
    (v_empresa, '76029743-7', 'Alvi Supermercado Mayorista S.A', true),
    (v_empresa, '92642000-3', 'Artel S.A', true),
    (v_empresa, '76481576-9', 'ASF Logistica SPA', true),
    (v_empresa, '97004000-5', 'Banco de Chile', true),
    (v_empresa, '99225000-3', 'CHUBB SEGUROS CHILE S.A.', true),
    (v_empresa, '76155763-7', 'Comech SPA', true),
    (v_empresa, '76195234-K', 'COMECIAL ARCAYA y CIA. LTDA.', true),
    (v_empresa, '99554560-8', 'COMERCIAL CCU S.A.', true),
    (v_empresa, '77497340-0', 'COMERCIAL LA TRIGUENA LIMITADA', true),
    (v_empresa, '76452878-6', 'COMERCIAL ORELLANA Y COMPANIA LTDA', true),
    (v_empresa, '84472400-4', 'Comercial Santa Elena S A', true),
    (v_empresa, '77054133-6', 'COMERCIALIZADORA Y DISTRIBUIDORA COSTA Y VÁSQUEZ LIMITADA', true),
    (v_empresa, '80186300-0', 'CONSORCIO INDUSTRIAL DE ALIMENTOS S.A.', true),
    (v_empresa, '99520000-7', 'COPEC S.A.', true),
    (v_empresa, '76211425-9', 'Delivery Hero E-Commerce Chile SPA', true),
    (v_empresa, '78218429-6', 'DETERGENTES MARTINEZ SPA', true),
    (v_empresa, '78179450-3', 'DISTRIBUIDORA EL PANADERO LIMITADA', true),
    (v_empresa, '76891214-9', 'DISTRIBUIDORA Y COMERCIAL CECILIO ALONSO HIDALGO SPA', true),
    (v_empresa, '76061718-0', 'DISTRIBUIDORA Y COMERCIAL EUROVENDING SPA', true),
    (v_empresa, '91144000-8', 'Embotelladora Andina S.A.', true),
    (v_empresa, '96800570-7', 'ENEL DISTRIBUCIÓN CHILE S.A', true),
    (v_empresa, '96806980-2', 'Entel PCS Telecomunicaciones S.A.', true),
    (v_empresa, '94528000-K', 'EVERCRISP SNACK PRODUCTOS DE CHILE S A', true),
    (v_empresa, '76375977-6', 'FABRICA DE CECINAS LA CHILENITA LTDA.', true),
    (v_empresa, '52003754-3', 'FELIX E.BAEZA C.COM.ARC-DOS COMERC. EIRL', true),
    (v_empresa, '96568740-8', 'GASCO GLP S.A.', true),
    (v_empresa, '76084413-6', 'GRAN PAVESI ALIMENTOS LIMITADA', true),
    (v_empresa, '96621750-2', 'HIPERMARC S.A', true),
    (v_empresa, '76967523-K', 'INSSUCHILE SPA', true),
    (v_empresa, '77278943-2', 'INVERSIONES BACOBA LIMITADA', true),
    (v_empresa, '11141499-8', 'JOSE ALBERTO TOLEDO PADILLA', true),
    (v_empresa, '81989400-0', 'JOSE RODRIGUEZ ALVARADO Y CIA LTDA', true),
    (v_empresa, '78780990-1', 'Junaplas', true),
    (v_empresa, '96532120-9', 'LA OFERTA COMERCIAL LIMITADA', true),
    (v_empresa, '84750800-0', 'Levaduras Collico S.A.', true),
    (v_empresa, '77084909-8', 'MARMIX SPA', true),
    (v_empresa, '77295199-K', 'MÉNDEZ HERRERA PEST CONTROL SPA', true),
    (v_empresa, '80393200-K', 'MOLINOS CUNACO S.A.', true),
    (v_empresa, '77368241-0', 'PAS PAN CO SPA', true),
    (v_empresa, '91004000-6', 'PRODUCTOS FERNANDEZ S.A.', true),
    (v_empresa, '96511330-4', 'PURATOS DE CHILE S.A.', true),
    (v_empresa, '8428154-9', 'RUDECINDO ANTONIO CATALAN ROJAS', true),
    (v_empresa, '77201740-5', 'SOC COMERCIAL K R LTDA', true),
    (v_empresa, '90635000-9', 'Telefonica Chile S.A', true),
    (v_empresa, '76058647-1', 'VERISURE CHILE SPA', true)
  on conflict (empresa_id, rut) do update set
    razon_social = excluded.razon_social,
    activo = true,
    updated_at = now();
end $$;
