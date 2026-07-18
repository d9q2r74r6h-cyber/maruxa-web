export type CanalWhatsapp = {
  phoneNumberId: string;
  accessToken: string;
  telefonoVisible: string | null;
  etiqueta: string;
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
    });
  }

  const idSecundario = limpiar(process.env.WHATSAPP_SECONDARY_PHONE_NUMBER_ID);
  const tokenSecundario =
    limpiar(process.env.WHATSAPP_SECONDARY_ACCESS_TOKEN) || tokenPrincipal;

  if (idSecundario && tokenSecundario && idSecundario !== idPrincipal) {
    canales.push({
      phoneNumberId: idSecundario,
      accessToken: tokenSecundario,
      telefonoVisible: limpiar(process.env.WHATSAPP_SECONDARY_DISPLAY_PHONE_NUMBER),
      etiqueta:
        limpiar(process.env.WHATSAPP_SECONDARY_CHANNEL_LABEL) ||
        'WhatsApp empresa',
    });
  }

  return canales;
}

export function obtenerCanalWhatsapp(phoneNumberId?: string | null) {
  const canales = obtenerCanalesWhatsapp();
  if (!phoneNumberId) return canales[0] || null;
  return canales.find((canal) => canal.phoneNumberId === phoneNumberId) || null;
}
