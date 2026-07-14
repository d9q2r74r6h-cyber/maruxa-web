import { createHmac, timingSafeEqual } from 'node:crypto';
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

function secretoMeta() {
  return process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET;
}

function tokenVerificacion() {
  return process.env.INSTAGRAM_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;
}

function firmaValida(cuerpo: string, firma: string | null) {
  const secreto = secretoMeta();
  if (!secreto || !firma?.startsWith('sha256=')) return false;

  const esperada = createHmac('sha256', secreto).update(cuerpo).digest('hex');
  const recibida = firma.slice('sha256='.length);

  if (esperada.length !== recibida.length) return false;

  return timingSafeEqual(
    Buffer.from(esperada, 'hex'),
    Buffer.from(recibida, 'hex')
  );
}

function tipoEvento(evento: any) {
  if (evento.field) return evento.field;
  if (evento.message?.text) return 'text';
  if (evento.message?.attachments?.[0]?.type) {
    return evento.message.attachments[0].type;
  }
  if (evento.postback) return 'postback';
  if (evento.read) return 'read';
  if (evento.delivery) return 'delivery';
  return 'desconocido';
}

function textoEvento(evento: any) {
  if (evento.value?.text) return evento.value.text;
  if (evento.value?.message) return evento.value.message;
  if (evento.value?.comment?.text) return evento.value.comment.text;
  if (evento.value?.comment?.message) return evento.value.comment.message;
  if (evento.value?.media?.caption) return evento.value.media.caption;
  if (evento.value?.item) return `Evento de Instagram: ${evento.value.item}`;
  if (evento.message?.text) return evento.message.text;
  if (evento.message?.attachments?.[0]?.type) {
    return `Adjunto recibido: ${evento.message.attachments[0].type}`;
  }
  if (evento.postback?.title) return evento.postback.title;
  if (evento.read) return 'Lectura de mensaje';
  if (evento.delivery) return 'Entrega de mensaje';
  return null;
}

function messageId(evento: any) {
  return (
    evento.value?.message_id ||
    evento.value?.id ||
    evento.value?.comment_id ||
    evento.value?.media_id ||
    evento.message?.mid ||
    evento.postback?.mid ||
    `${evento.sender?.id || evento.value?.from?.id || evento.entry_id || 'sin-remitente'}-${evento.timestamp || evento.value?.timestamp || Date.now()}-${evento.field || 'evento'}`
  );
}

function senderId(evento: any) {
  return (
    evento.sender?.id ||
    evento.value?.sender?.id ||
    evento.value?.from?.id ||
    evento.value?.user_id ||
    evento.value?.ig_user_id ||
    null
  );
}

function recipientId(evento: any) {
  return evento.recipient?.id || evento.entry_id || null;
}

async function enviarMensajeWhatsApp(telefono: string, mensaje: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const destino = telefono.replace(/\D/g, '');

  if (!token || !phoneNumberId || !destino) {
    return 'Falta token, phone number id o telefono destino.';
  }

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
        type: 'text',
        text: {
          preview_url: false,
          body: mensaje,
        },
      }),
    }
  );

  if (respuesta.ok) return null;

  const detalle = await respuesta.text();
  const errorTexto = detalle || `Meta respondio ${respuesta.status}`;
  const errorPlantilla = await enviarPlantillaNotificacionWhatsApp(
    destino,
    mensaje
  );

  return errorPlantilla
    ? `${errorTexto}. Fallback plantilla: ${errorPlantilla}`
    : null;
}

async function enviarPlantillaNotificacionWhatsApp(
  destino: string,
  mensaje: string
) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const telefonoDestino = destino.replace(/\D/g, '');
  const templateName =
    process.env.WHATSAPP_NOTIFICATION_TEMPLATE_NAME ||
    'aviso_nuevo_mensaje_admin';
  const languageCode =
    process.env.WHATSAPP_NOTIFICATION_TEMPLATE_LANGUAGE || 'es_CL';

  if (!token || !phoneNumberId || !telefonoDestino || !templateName) {
    return 'No hay plantilla de notificacion configurada.';
  }

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
        to: telefonoDestino,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: mensaje.slice(0, 900),
                },
              ],
            },
          ],
        },
      }),
    }
  );

  if (respuesta.ok) return null;

  const detalle = await respuesta.text();
  return detalle || `Meta respondio ${respuesta.status}`;
}

async function avisarAdministradoresInstagram(
  admin: NonNullable<ReturnType<typeof crearAdmin>>,
  empresaId: string,
  datos: {
    senderId: string;
    resumen: string;
  }
) {
  const { data: perfiles } = await admin
    .from('perfiles_usuario')
    .select('id,nombre_visible,notificar_whatsapp,notificacion_whatsapp')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .eq('notificar_whatsapp', true)
    .not('notificacion_whatsapp', 'is', null);

  if (!perfiles?.length) return [];

  const texto = [
    'Nuevo mensaje Instagram',
    `Cliente: ${datos.senderId}`,
    `Detalle: ${datos.resumen || 'Mensaje recibido.'}`,
    'Revisar en https://panaderiamaruxa.cl/admin/whatsapp',
  ].join('\n');

  const resultados = await Promise.all(
    perfiles.map((perfil: any) =>
      enviarPlantillaNotificacionWhatsApp(
        perfil.notificacion_whatsapp,
        texto
      ).then((error) =>
        error
          ? `WhatsApp ${perfil.nombre_visible || perfil.id}: ${error}`
          : null
      )
    )
  );

  return resultados.filter(Boolean) as string[];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const modo = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const desafio = url.searchParams.get('hub.challenge');
  const tokenConfigurado = tokenVerificacion()?.trim();

  if (!modo && !token && !desafio) {
    const admin = crearAdmin();
    let baseDatosLista = false;
    let baseDatosError: string | null = admin ? null : 'Cliente Supabase no configurado.';
    let baseDatosEstado: number | null = null;
    let destinosWhatsappConfigurados = 0;

    if (admin) {
      const resultado = await admin
        .from('instagram_eventos')
        .select('id,created_at,tipo,estado,sender_id,texto,observacion')
        .order('created_at', { ascending: false })
        .limit(5);
      const { count } = await admin
        .from('perfiles_usuario')
        .select('id', { count: 'exact', head: true })
        .eq('activo', true)
        .eq('notificar_whatsapp', true)
        .not('notificacion_whatsapp', 'is', null);
      baseDatosLista = !resultado.error;
      baseDatosEstado = resultado.status;
      baseDatosError = resultado.error ? JSON.stringify(resultado.error) : null;
      destinosWhatsappConfigurados = count || 0;

      return NextResponse.json({
        webhook: 'instagram',
        disponible: true,
        tokenConfigurado: Boolean(tokenConfigurado),
        appSecretConfigurado: Boolean(secretoMeta()),
        supabaseServidorConfigurado: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        baseDatosLista,
        baseDatosEstado,
        baseDatosError,
        destinosWhatsappConfigurados,
        ultimosEventos: resultado.data || [],
      });
    }

    return NextResponse.json({
      webhook: 'instagram',
      disponible: true,
      tokenConfigurado: Boolean(tokenConfigurado),
      appSecretConfigurado: Boolean(secretoMeta()),
      supabaseServidorConfigurado: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      baseDatosLista,
      baseDatosEstado,
      baseDatosError,
      destinosWhatsappConfigurados,
    });
  }

  if (
    modo === 'subscribe' &&
    token &&
    tokenConfigurado &&
    token.trim() === tokenConfigurado &&
    desafio
  ) {
    return new Response(desafio, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  return NextResponse.json({ error: 'Verificacion invalida.' }, { status: 403 });
}

export async function POST(request: Request) {
  const cuerpo = await request.text();

  if (!firmaValida(cuerpo, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Firma invalida.' }, { status: 401 });
  }

  const admin = crearAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: 'Configuracion de Supabase incompleta.' },
      { status: 503 }
    );
  }

  let payload: any;
  try {
    payload = JSON.parse(cuerpo);
  } catch {
    return NextResponse.json({ error: 'JSON invalido.' }, { status: 400 });
  }

  let empresaId = process.env.INSTAGRAM_EMPRESA_ID || process.env.WHATSAPP_EMPRESA_ID;

  if (!empresaId) {
    const { data: empresa } = await admin
      .from('empresas')
      .select('id')
      .eq('slug', 'maruxa')
      .eq('activo', true)
      .limit(1)
      .maybeSingle();
    empresaId = empresa?.id;
  }

  if (!empresaId) {
    return NextResponse.json(
      { error: 'No se pudo identificar la empresa receptora.' },
      { status: 503 }
    );
  }

  const eventos = (payload.entry || []).flatMap((entrada: any) => {
    const mensajes = (entrada.messaging || []).map((evento: any) => ({
      ...evento,
      entry_id: entrada.id,
      recipient: evento.recipient || { id: entrada.id },
      formato: 'messaging',
    }));

    const cambios = (entrada.changes || []).map((cambio: any) => ({
      ...cambio,
      entry_id: entrada.id,
      timestamp: entrada.time,
      formato: 'changes',
    }));

    return [...mensajes, ...cambios];
  });

  for (const evento of eventos) {
    const id = messageId(evento);
    if (!id) continue;

    const { data: existente } = await admin
      .from('instagram_eventos')
      .select('id')
      .eq('message_id', id)
      .maybeSingle();

    if (existente) continue;

    const tipo = tipoEvento(evento);
    const texto = textoEvento(evento);
    const remitente = senderId(evento) || 'Instagram';

    const observacionEvento = payload.object
      ? `Origen Meta: ${payload.object} (${evento.formato || 'evento'})`
      : 'Mensaje recibido desde Instagram.';

    const { data: eventoInsertado } = await admin
      .from('instagram_eventos')
      .insert({
        empresa_id: empresaId,
        sender_id: remitente,
        recipient_id: recipientId(evento),
        message_id: id,
        tipo,
        texto,
        estado: ['read', 'delivery'].includes(tipo) ? 'informativo' : 'recibido',
        observacion: observacionEvento,
        payload,
      })
      .select('id,observacion')
      .single();

    if (!['read', 'delivery'].includes(tipo)) {
      const erroresAviso = await avisarAdministradoresInstagram(admin, empresaId, {
        senderId: remitente,
        resumen: texto || `Evento de Instagram: ${tipo}`,
      });

      if (eventoInsertado?.id && erroresAviso.length > 0) {
        await admin
          .from('instagram_eventos')
          .update({
            observacion: [
              eventoInsertado.observacion,
              `Aviso administrador no enviado: ${erroresAviso.join(' | ')}`,
            ]
              .filter(Boolean)
              .join('\n'),
          })
          .eq('id', eventoInsertado.id);
      }
    }
  }

  return NextResponse.json({ recibido: true });
}
