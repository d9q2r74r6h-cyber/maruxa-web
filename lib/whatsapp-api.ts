import type { CanalWhatsapp } from '@/lib/whatsapp-canales';

export async function enviarPorWhatsapp(
  canal: CanalWhatsapp,
  payload: Record<string, unknown>
) {
  const respuesta = await fetch(
    canal.proveedor === '360dialog'
      ? 'https://waba-v2.360dialog.io/messages'
      : `https://graph.facebook.com/v20.0/${canal.phoneNumberId}/messages`,
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
