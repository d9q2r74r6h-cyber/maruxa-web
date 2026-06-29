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
    evento.message?.mid ||
    evento.postback?.mid ||
    `${evento.sender?.id || 'sin-remitente'}-${evento.timestamp || Date.now()}`
  );
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

    if (admin) {
      const resultado = await admin
        .from('instagram_eventos')
        .select('id')
        .limit(1);
      baseDatosLista = !resultado.error;
      baseDatosEstado = resultado.status;
      baseDatosError = resultado.error ? JSON.stringify(resultado.error) : null;
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

  const eventos = (payload.entry || []).flatMap((entrada: any) =>
    (entrada.messaging || []).map((evento: any) => ({
      ...evento,
      recipient: evento.recipient || { id: entrada.id },
    }))
  );

  for (const evento of eventos) {
    const id = messageId(evento);
    if (!id) continue;

    const { data: existente } = await admin
      .from('instagram_eventos')
      .select('id')
      .eq('message_id', id)
      .maybeSingle();

    if (existente) continue;

    await admin.from('instagram_eventos').insert({
      empresa_id: empresaId,
      sender_id: evento.sender?.id || null,
      recipient_id: evento.recipient?.id || null,
      message_id: id,
      tipo: tipoEvento(evento),
      texto: textoEvento(evento),
      estado: ['read', 'delivery'].includes(tipoEvento(evento)) ? 'informativo' : 'recibido',
      observacion: payload.object ? `Origen Meta: ${payload.object}` : 'Mensaje recibido desde Instagram.',
      payload,
    });
  }

  return NextResponse.json({ recibido: true });
}
