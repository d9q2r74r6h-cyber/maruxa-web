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
      telefonoVisible: limpiar(process.env.WHATSAPP_DISPLAY_PHONE_NUMBER),
      etiqueta: limpiar(process.env.WHATSAPP_CHANNEL_LABEL) || 'WhatsApp principal',
      proveedor: 'meta',
    });
  }

  const apiKey360 = limpiar(process.env.WHATSAPP_360DIALOG_API_KEY);
  const id360 =
    limpiar(process.env.WHATSAPP_360DIALOG_PHONE_NUMBER_ID) ||
    limpiar(process.env.WHATSAPP_SECONDARY_PHONE_NUMBER_ID);

  if (apiKey360 && id360 && id360 !== idPrincipal) {
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

  const idSecundario = limpiar(process.env.WHATSAPP_SECONDARY_PHONE_NUMBER_ID);
  const tokenSecundario =
    limpiar(process.env.WHATSAPP_SECONDARY_ACCESS_TOKEN) || tokenPrincipal;

  if (
    idSecundario &&
    tokenSecundario &&
    idSecundario !== idPrincipal &&
    idSecundario !== id360
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
  return canales.find((canal) => canal.phoneNumberId === phoneNumberId) || null;
}
