import type { CanalWhatsapp } from '@/lib/whatsapp-canales';

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
    const plantilla =
      plantillas.find(
        (item: any) => item.name === nombre && item.status === 'APPROVED'
      ) || plantillas.find((item: any) => item.name === nombre);
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
