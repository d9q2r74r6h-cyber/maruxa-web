export type CanalWhatsapp = {
  phoneNumberId: string;
  accessToken: string;
  telefonoVisible: string | null;
  etiqueta: string;
  proveedor: 'meta' | '360dialog';
};

function limpiar(valor: string | undefined) {
  return valor?.trim() || null;
}

export function obtenerCanalesWhatsapp(): CanalWhatsapp[] {
  const tokenPrincipal = limpiar(process.env.WHATSAPP_ACCESS_TOKEN);
  const idPrincipal = limpiar(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const canales: CanalWhatsapp[] = [];

  if (tokenPrincipal && idPrincipal) {
    canales.push({
      phoneNumberId: idPrincipal,
      accessToken: tokenPrincipal,
      telefonoVisible:
        limpiar(process.env.WHATSAPP_DISPLAY_PHONE_NUMBER) ||
        '+56 9 8623 2447',
      etiqueta: limpiar(process.env.WHATSAPP_CHANNEL_LABEL) || 'WhatsApp principal',
      proveedor: 'meta',
    });
  }

  const apiKey360 = limpiar(process.env.WHATSAPP_360DIALOG_API_KEY);
  const id360 =
    limpiar(process.env.WHATSAPP_360DIALOG_PHONE_NUMBER_ID) ||
    limpiar(process.env.WHATSAPP_SECONDARY_PHONE_NUMBER_ID);
  const idSecundario = limpiar(process.env.WHATSAPP_SECONDARY_PHONE_NUMBER_ID);
  const tokenSecundario =
    limpiar(process.env.WHATSAPP_SECONDARY_ACCESS_TOKEN) || tokenPrincipal;
  const idPedidos = limpiar(process.env.WHATSAPP_ORDERS_PHONE_NUMBER_ID);
  const canalDirectoPedidosConfigurado = Boolean(
    idSecundario &&
      tokenSecundario &&
      idPedidos === idSecundario
  );

  if (
    apiKey360 &&
    id360 &&
    id360 !== idPrincipal &&
    !canalDirectoPedidosConfigurado
  ) {
    canales.push({
      phoneNumberId: id360,
      accessToken: apiKey360,
      telefonoVisible:
        limpiar(process.env.WHATSAPP_360DIALOG_DISPLAY_PHONE_NUMBER) ||
        limpiar(process.env.WHATSAPP_SECONDARY_DISPLAY_PHONE_NUMBER),
      etiqueta:
        limpiar(process.env.WHATSAPP_360DIALOG_CHANNEL_LABEL) ||
        limpiar(process.env.WHATSAPP_SECONDARY_CHANNEL_LABEL) ||
        'WhatsApp 360dialog',
      proveedor: '360dialog',
    });
  }

  if (
    idSecundario &&
    tokenSecundario &&
    idSecundario !== idPrincipal &&
    (canalDirectoPedidosConfigurado || idSecundario !== id360)
  ) {
    canales.push({
      phoneNumberId: idSecundario,
      accessToken: tokenSecundario,
      telefonoVisible: limpiar(process.env.WHATSAPP_SECONDARY_DISPLAY_PHONE_NUMBER),
      etiqueta:
        limpiar(process.env.WHATSAPP_SECONDARY_CHANNEL_LABEL) ||
        'WhatsApp empresa',
      proveedor: 'meta',
    });
  }

  return canales;
}

export function obtenerCanalWhatsapp(phoneNumberId?: string | null) {
  const canales = obtenerCanalesWhatsapp();
  if (!phoneNumberId) return canales[0] || null;

  const idSolicitado = limpiar(phoneNumberId);
  const idPedidos = limpiar(process.env.WHATSAPP_ORDERS_PHONE_NUMBER_ID);
  const id360 = limpiar(process.env.WHATSAPP_360DIALOG_PHONE_NUMBER_ID);

  // Las conversaciones anteriores a la migracion conservan el Phone Number ID
  // de 360dialog. Al responderlas, deben salir por el nuevo canal directo Meta.
  if (idSolicitado && id360 && idSolicitado === id360 && idPedidos) {
    const canalMigrado = canales.find(
      (canal) =>
        canal.phoneNumberId === idPedidos && canal.proveedor === 'meta'
    );
    if (canalMigrado) return canalMigrado;
  }

  return canales.find((canal) => canal.phoneNumberId === idSolicitado) || null;
}

export function obtenerCanalPedidosWhatsapp() {
  const canales = obtenerCanalesWhatsapp();
  const idPreferido = limpiar(process.env.WHATSAPP_ORDERS_PHONE_NUMBER_ID);
  if (idPreferido) {
    const porId = canales.find((canal) => canal.phoneNumberId === idPreferido);
    if (porId) return porId;
  }

  return (
    canales.find((canal) =>
      String(canal.telefonoVisible || '').replace(/\D/g, '').endsWith('966785041')
    ) || canales.find((canal) => canal.proveedor === '360dialog') || null
  );
}
