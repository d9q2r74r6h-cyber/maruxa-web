import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function crearAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !url) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function normalizarDestino(telefono: string | null | undefined) {
  return String(telefono || '').replace(/\D/g, '');
}

export async function POST(request: Request) {
  const admin = crearAdmin();
  const tokenSesion = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!admin || !tokenSesion) {
    return NextResponse.json({ error: 'Sesion no disponible.' }, { status: 401 });
  }

  const { data: autenticacion } = await admin.auth.getUser(tokenSesion);
  if (!autenticacion.user) {
    return NextResponse.json({ error: 'Sesion invalida.' }, { status: 401 });
  }

  const { data: perfil } = await admin
    .from('perfiles_usuario')
    .select('id,empresa_id,nombre_visible,activo,notificar_whatsapp,notificacion_whatsapp')
    .eq('id', autenticacion.user.id)
    .maybeSingle();

  if (!perfil?.activo) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  const destino = normalizarDestino(perfil.notificacion_whatsapp);
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName =
    process.env.WHATSAPP_NOTIFICATION_TEMPLATE_NAME ||
    'aviso_nuevo_mensaje_admin';
  const languageCode =
    process.env.WHATSAPP_NOTIFICATION_TEMPLATE_LANGUAGE || 'es_CL';

  if (!perfil.notificar_whatsapp || !destino) {
    return NextResponse.json(
      { error: 'Activa y guarda un numero para avisos WhatsApp.' },
      { status: 400 }
    );
  }

  if (!token || !phoneNumberId) {
    return NextResponse.json(
      { error: 'Configuracion de WhatsApp incompleta.' },
      { status: 503 }
    );
  }

  const texto =
    'Prueba de avisos Maruxa. Si recibes este mensaje, las notificaciones de nuevos mensajes estan funcionando.';
  const respuesta = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: destino,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: texto }],
            },
          ],
        },
      }),
    }
  );

  const detalle = await respuesta.text();
  let meta: any = null;
  try {
    meta = detalle ? JSON.parse(detalle) : null;
  } catch {
    meta = detalle;
  }

  if (!respuesta.ok) {
    return NextResponse.json(
      { error: meta?.error?.message || detalle || `Meta respondio ${respuesta.status}`, meta },
      { status: respuesta.status }
    );
  }

  const messageId = meta?.messages?.[0]?.id;
  if (messageId) {
    await admin.from('whatsapp_eventos').insert({
      empresa_id: perfil.empresa_id,
      message_id: messageId,
      telefono: `+${destino}`,
      tipo: 'aviso_administrador',
      estado: 'aceptado',
      observacion: 'Prueba aceptada por Meta; esperando estado de entrega.',
      payload: {
        direccion: 'saliente',
        origen: 'prueba_aviso_administrador',
        perfil_id: perfil.id,
        meta,
      },
    });
  }

  return NextResponse.json({
    enviado: true,
    messageId: messageId || null,
    destino: `+${destino}`,
    estado: 'aceptado',
  });
}
