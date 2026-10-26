import type { CanalWhatsapp } from '@/lib/whatsapp-canales';

export async function enviarPorWhatsapp(
  canal: CanalWhatsapp,
  payload: Record<string, unknown>
) {
  const apiKey360 = process.env.WHATSAPP_360DIALOG_API_KEY?.trim();
  const respuesta = await fetch(
    apiKey360
      ? 'https://waba-v2.360dialog.io/messages'
      : `https://graph.facebook.com/v20.0/${canal.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: apiKey360
        ? { 'D360-API-KEY': apiKey360, 'Content-Type': 'application/json' }
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
