import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { obtenerCanalWhatsapp } from '@/lib/whatsapp-canales';

function crearAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !url) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function normalizarDestino(telefono: string) {
  return String(telefono || '').replace(/\D/g, '');
}

export async function POST(request: Request) {
  const admin = crearAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: 'Servidor WhatsApp no configurado.' },
      { status: 503 }
    );
  }

  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.replace(/^Bearer\s+/i, '');

  if (!accessToken) {
    return NextResponse.json({ error: 'Sesion requerida.' }, { status: 401 });
  }

  const { data: autenticacion, error: errorAutenticacion } =
    await admin.auth.getUser(accessToken);

  if (errorAutenticacion || !autenticacion.user) {
    return NextResponse.json({ error: 'Sesion invalida.' }, { status: 401 });
  }

  const { data: perfil } = await admin
    .from('perfiles_usuario')
    .select('activo,empresa_id,nombre_visible')
    .eq('id', autenticacion.user.id)
    .maybeSingle();

  if (!perfil?.activo) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  const { telefono, mensaje, idsPendientes, phoneNumberId } = await request.json();
  const destino = normalizarDestino(telefono);
  const canal = obtenerCanalWhatsapp(phoneNumberId);

  if (!canal) {
    return NextResponse.json(
      { error: 'El numero de WhatsApp seleccionado no esta configurado.' },
      { status: 503 }
    );
  }

  if (!destino || !mensaje) {
    return NextResponse.json(
      { error: 'Telefono y mensaje son requeridos.' },
      { status: 400 }
    );
  }

  const respuesta = await fetch(
    `https://graph.facebook.com/v20.0/${canal.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${canal.accessToken}`,
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

  const dataMeta = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    return NextResponse.json(
      { error: JSON.stringify(dataMeta) || `Meta respondio ${respuesta.status}` },
      { status: 502 }
    );
  }

  const messageId =
    dataMeta?.messages?.[0]?.id ||
    `respuesta-${destino}-${Date.now()}`;

  if (Array.isArray(idsPendientes) && idsPendientes.length > 0) {
    await admin
      .from('whatsapp_eventos')
      .update({
        estado: 'respondido',
        observacion: 'Respuesta enviada desde la bandeja WhatsApp.',
      })
      .in('id', idsPendientes);
  }

  const { error: errorRegistro } = await admin.from('whatsapp_eventos').insert({
    empresa_id: perfil.empresa_id,
    message_id: messageId,
    telefono,
    tipo: 'respuesta',
    estado: 'enviado',
    observacion: mensaje,
    payload: {
      direccion: 'saliente',
      mensaje,
      origen: 'admin',
      enviado_por: perfil.nombre_visible || autenticacion.user.email || null,
      canal_phone_number_id: canal.phoneNumberId,
      canal_telefono: canal.telefonoVisible,
      canal_etiqueta: canal.etiqueta,
      meta: dataMeta,
    },
  });

  if (errorRegistro) {
    return NextResponse.json(
      {
        error: `Mensaje enviado, pero no se pudo registrar en el chat: ${errorRegistro.message}`,
        enviado: true,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message_id: messageId,
    phone_number_id: canal.phoneNumberId,
  });
}
