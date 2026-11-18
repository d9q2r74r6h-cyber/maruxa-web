import type { CanalWhatsapp } from '@/lib/whatsapp-canales';

export function resumirErrorWhatsapp(
  detalle: unknown,
  mensajePredeterminado = 'No se pudo enviar el aviso por WhatsApp. Revisa la configuración.'
) {
  const texto = String(detalle || '');

  if (/132001|template name.*does not exist|template.*not exist/i.test(texto)) {
    return 'La plantilla de aviso no está disponible o no está aprobada en Meta.';
  }
  if (/131047|24.?hour|outside the allowed window/i.test(texto)) {
    return 'El mensaje requiere una plantilla aprobada porque la conversación ya venció.';
  }
  if (/oauth|access token|permission/i.test(texto)) {
    return 'WhatsApp rechazó la conexión. Revisa los permisos y el token del canal.';
  }

  return mensajePredeterminado;
}

export async function resolverPlantillaWhatsapp(
  canal: CanalWhatsapp,
  nombre: string,
  idiomaPredeterminado: string
) {
  if (canal.proveedor !== 'meta') {
    return { nombre, idioma: idiomaPredeterminado, encontrada: true };
  }

  const wabaId =
    process.env.WHATSAPP_ORDERS_BUSINESS_ACCOUNT_ID || '1640388854109907';
  const parametros = new URLSearchParams({
    fields: 'name,status,language',
    name: nombre,
    limit: '100',
  });
  try {
    const respuesta = await fetch(
      `https://graph.facebook.com/v26.0/${wabaId}/message_templates?${parametros}`,
      { headers: { Authorization: `Bearer ${canal.accessToken}` }, cache: 'no-store' }
    );
    if (!respuesta.ok) {
      return { nombre, idioma: idiomaPredeterminado, encontrada: null };
    }
    const data = await respuesta.json();
    const plantillas = Array.isArray(data?.data) ? data.data : [];
    const candidatas = plantillas.filter((item: any) => item.name === nombre);
    const plantilla =
      candidatas.find(
        (item: any) =>
          item.status === 'APPROVED' && item.language === idiomaPredeterminado
      ) ||
      candidatas.find((item: any) => item.status === 'APPROVED') ||
      candidatas.find((item: any) => item.language === idiomaPredeterminado) ||
      candidatas[0];
    return {
      nombre,
      idioma: plantilla?.language || idiomaPredeterminado,
      encontrada: Boolean(plantilla),
      estado: plantilla?.status || null,
    };
  } catch {
    return { nombre, idioma: idiomaPredeterminado, encontrada: null };
  }
}

export async function enviarPorWhatsapp(
  canal: CanalWhatsapp,
  payload: Record<string, unknown>
) {
  const respuesta = await fetch(
    canal.proveedor === '360dialog'
      ? 'https://waba-v2.360dialog.io/messages'
      : `https://graph.facebook.com/v26.0/${canal.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: canal.proveedor === '360dialog'
        ? { 'D360-API-KEY': canal.accessToken, 'Content-Type': 'application/json' }
        : {
            Authorization: `Bearer ${canal.accessToken}`,
            'Content-Type': 'application/json',
          },
      body: JSON.stringify(payload),
    }
  );

  const texto = await respuesta.text();
  let data: any = null;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    data = texto;
  }

  return { respuesta, data, texto };
}
