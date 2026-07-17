do $$
declare
  v_empresa_id uuid;
begin
  select id
    into v_empresa_id
  from public.empresas
  where slug = 'maruxa'
  limit 1;

  if v_empresa_id is null then
    raise exception 'No se encontro la empresa maruxa';
  end if;

  insert into public.proveedores (empresa_id, rut, razon_social, activo)
  values
    (v_empresa_id, '11141499-8', 'JOSE ALBERTO TOLEDO PADILLA', true),
    (v_empresa_id, '61808000-5', 'AGUAS ANDINAS S.A.', true),
    (v_empresa_id, '76029743-7', 'Alvi Supermercado Mayorista S.A', true),
    (v_empresa_id, '76052927-3', 'Soc. Conc. Autopista Nueva Vespucio Sur S.A.', true),
    (v_empresa_id, '76058647-1', 'VERISURE CHILE SPA', true),
    (v_empresa_id, '76061718-0', 'DISTRIBUIDORA Y COMERCIAL EUROVENDING SPA', true),
    (v_empresa_id, '76155763-7', 'Comech SPA', true),
    (v_empresa_id, '76186819-5', 'COMERCIAL GERMIX SPA', true),
    (v_empresa_id, '76195234-K', 'COMECIAL ARCAYA y CIA. LTDA.', true),
    (v_empresa_id, '76211425-9', 'Delivery Hero E-Commerce Chile SPA', true),
    (v_empresa_id, '76375977-6', 'FABRICA DE CECINAS LA CHILENITA LTDA.', true),
    (v_empresa_id, '76376061-8', 'SOCIEDAD CONCESIONARIA VESPUCIO ORIENTE S.A.', true),
    (v_empresa_id, '76415505-K', 'MEL ALIMENTOS SPA', true),
    (v_empresa_id, '76452878-6', 'COMERCIAL ORELLANA Y COMPANIA LTDA', true),
    (v_empresa_id, '76481576-9', 'ASF LOGISTICA SPA', true),
    (v_empresa_id, '76496130-7', 'Sociedad Concesionaria Costanera Norte S.A.', true),
    (v_empresa_id, '76891214-9', 'DISTRIBUIDORA Y COMERCIAL CECILIO ALONSO HIDALGO SPA', true),
    (v_empresa_id, '76967523-K', 'INSSUCHILE SPA', true),
    (v_empresa_id, '76979850-1', 'Fabrica de Bandejas Limitada', true),
    (v_empresa_id, '77084909-8', 'MARMIX SPA', true),
    (v_empresa_id, '77201740-5', 'SOC COMERCIAL K R LTDA', true),
    (v_empresa_id, '77230963-5', 'CGL EMPRESAS SPA', true),
    (v_empresa_id, '77278943-2', 'INVERSIONES BACOBA LIMITADA', true),
    (v_empresa_id, '77295199-K', 'MÉNDEZ & HERRERA PEST CONTROL SPA', true),
    (v_empresa_id, '77368241-0', 'PAS PAN CO SPA', true),
    (v_empresa_id, '78179450-3', 'DISTRIBUIDORA EL PANADERO LIMITADA', true),
    (v_empresa_id, '78218429-6', 'DETERGENTES MARTINEZ SPA', true),
    (v_empresa_id, '78780990-1', 'SOC FABRICA DE BOLSAS PLASTICAS JUNAPLAS LTDA', true),
    (v_empresa_id, '79984240-8', 'AGROSUPER COMERCIALIZADORA DE ALIMENTOS LTDA.', true),
    (v_empresa_id, '80186300-0', 'CONSORCIO INDUSTRIAL DE ALIMENTOS S.A.', true),
    (v_empresa_id, '80393200-K', 'MOLINOS CUNACO S.A.', true),
    (v_empresa_id, '81989400-0', 'JOSE RODRIGUEZ ALVARADO Y CIA LTDA', true),
    (v_empresa_id, '8428154-9', 'RUDECINDO ANTONIO CATALAN ROJAS', true),
    (v_empresa_id, '84472400-4', 'Comercial Santa Elena S A', true),
    (v_empresa_id, '84750800-0', 'Levaduras Collico S.A.', true),
    (v_empresa_id, '90635000-9', 'Telefonica Chile S.A', true),
    (v_empresa_id, '90703000-8', 'Nestlé Chile S.A.', true),
    (v_empresa_id, '90828000-8', 'MOLINO LA ESTAMPA SA', true),
    (v_empresa_id, '91004000-6', 'PRODUCTOS FERNANDEZ S.A.', true),
    (v_empresa_id, '91144000-8', 'Embotelladora Andina S.A.', true),
    (v_empresa_id, '92642000-3', 'Artel S.A', true),
    (v_empresa_id, '94528000-K', 'EVERCRISP SNACK PRODUCTOS DE CHILE S A', true),
    (v_empresa_id, '96511330-4', 'PURATOS DE CHILE S.A.', true),
    (v_empresa_id, '96532120-9', 'LA OFERTA COMERCIAL LIMITADA', true),
    (v_empresa_id, '96568740-8', 'GASCO GLP S.A.', true),
    (v_empresa_id, '96621750-2', 'HIPERMARC S.A', true),
    (v_empresa_id, '96689310-9', 'TRANSBANK S.A.', true),
    (v_empresa_id, '96800570-7', 'ENEL DISTRIBUCIÓN CHILE S.A', true),
    (v_empresa_id, '96806980-2', 'Entel PCS Telecomunicaciones S.A.', true),
    (v_empresa_id, '96875230-8', 'RUTA DEL MAIPO SOCIEDAD CONCESIONARIA, S.A.', true),
    (v_empresa_id, '96880700-5', 'ALIMENTOS Y CECINAS KASSEL S.A.', true),
    (v_empresa_id, '96912590-0', 'TANNER LEASING S.A.', true),
    (v_empresa_id, '96945440-8', 'SOC CONCESIONARIA AUTOPISTA CENTRAL S A', true),
    (v_empresa_id, '97004000-5', 'Banco de Chile', true),
    (v_empresa_id, '99225000-3', 'CHUBB SEGUROS CHILE S.A.', true),
    (v_empresa_id, '99520000-7', 'COPEC S.A.', true),
    (v_empresa_id, '99554560-8', 'COMERCIAL CCU S.A.', true)
  on conflict (empresa_id, rut) do update
  set razon_social = excluded.razon_social,
      activo = true,
      updated_at = now();
end
$$;
