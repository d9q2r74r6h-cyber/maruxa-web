export type EstadoConfiguracionDte = {
  ambiente: 'certificacion' | 'produccion';
  certificadoConfigurado: boolean;
  claveCertificadoConfigurada: boolean;
  rutEmisorConfigurado: boolean;
  resolucionConfigurada: boolean;
  listoParaFirmar: boolean;
};

export function obtenerEstadoConfiguracionDte(): EstadoConfiguracionDte {
  const ambiente =
    process.env.SII_AMBIENTE === 'produccion'
      ? 'produccion'
      : 'certificacion';
  const certificadoConfigurado = Boolean(
    process.env.SII_CERTIFICADO_PFX_BASE64
  );
  const claveCertificadoConfigurada = Boolean(
    process.env.SII_CERTIFICADO_PASSWORD
  );
  const rutEmisorConfigurado = Boolean(process.env.SII_RUT_EMISOR);
  const resolucionConfigurada = Boolean(
    process.env.SII_NUMERO_RESOLUCION &&
      process.env.SII_FECHA_RESOLUCION
  );

  return {
    ambiente,
    certificadoConfigurado,
    claveCertificadoConfigurada,
    rutEmisorConfigurado,
    resolucionConfigurada,
    listoParaFirmar:
      certificadoConfigurado &&
      claveCertificadoConfigurada &&
      rutEmisorConfigurado &&
      resolucionConfigurada,
  };
}

