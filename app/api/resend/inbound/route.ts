import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const correoPublico = 'contacto@panaderiamaruxa.cl';
const correoDestino = 'panaderiamaruxa@hotmail.com';

function normalizarDireccion(valor: string) {
  const coincidencia = valor.match(/<([^>]+)>/);
  return (coincidencia?.[1] || valor).trim().toLowerCase();
}

function crearAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !url) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function obtenerEmpresaId(
  admin: NonNullable<ReturnType<typeof crearAdmin>>
) {
  const configurada =
    process.env.RESEND_EMPRESA_ID || process.env.WHATSAPP_EMPRESA_ID;
  if (configurada) return configurada;

  const { data, error } = await admin.from('empresas').select('id').limit(2);
  if (error || data?.length !== 1) return null;
  return data[0].id as string;
}

export function GET() {
  return NextResponse.json({
    servicio: 'Resend Inbound',
    configurado: Boolean(
      process.env.RESEND_API_KEY &&
        process.env.RESEND_WEBHOOK_SECRET &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
  });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const admin = crearAdmin();

  if (!apiKey || !webhookSecret || !admin) {
    console.error('Falta configurar Resend Inbound.');
    return NextResponse.json(
      { error: 'Servicio no configurado' },
      { status: 503 }
    );
  }

  const resend = new Resend(apiKey);
  const payload = await request.text();
  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');

  if (!id || !timestamp || !signature) {
    return NextResponse.json(
      { error: 'Faltan encabezados de firma' },
      { status: 400 }
    );
  }

  try {
    const evento = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    });

    if (evento.type !== 'email.received') {
      return NextResponse.json({ procesado: false });
    }

    const destinatarios = [
      ...evento.data.to,
      ...evento.data.cc,
      ...evento.data.bcc,
    ].map(normalizarDireccion);

    if (!destinatarios.includes(correoPublico)) {
      return NextResponse.json({
        procesado: false,
        motivo: 'Destinatario no configurado',
      });
    }

    const empresaId = await obtenerEmpresaId(admin);
    if (!empresaId) {
      return NextResponse.json(
        { error: 'No se pudo identificar la empresa receptora' },
        { status: 503 }
      );
    }

    const { data: correo, error: errorCorreo } =
      await resend.emails.receiving.get(evento.data.email_id);

    if (errorCorreo || !correo) {
      console.error('No se pudo obtener el contenido del correo:', errorCorreo);
      return NextResponse.json(
        { error: 'No se pudo obtener el contenido del correo' },
        { status: 502 }
      );
    }

    const { error: errorRegistro } = await admin.from('correo_eventos').upsert(
      {
        empresa_id: empresaId,
        email_id: evento.data.email_id,
        message_id: correo.message_id || evento.data.message_id,
        remitente: normalizarDireccion(correo.from),
        destinatarios: correo.to.map(normalizarDireccion),
        asunto: correo.subject || '(Sin asunto)',
        texto: correo.text,
        html: correo.html,
        adjuntos: correo.attachments || [],
        direccion: 'entrante',
        estado: 'recibido',
        payload: {
          from_original: correo.from,
          cc: correo.cc || [],
          bcc: correo.bcc || [],
          reply_to: correo.reply_to || [],
          headers: correo.headers || {},
        },
        created_at: correo.created_at || evento.data.created_at,
      },
      { onConflict: 'email_id', ignoreDuplicates: true }
    );

    if (errorRegistro) {
      console.error('No se pudo guardar el correo recibido:', errorRegistro);
      return NextResponse.json(
        { error: 'No se pudo guardar el correo recibido' },
        { status: 500 }
      );
    }

    const { data, error } = await resend.emails.receiving.forward({
      emailId: evento.data.email_id,
      from: `Panadería Maruxa <${correoPublico}>`,
      to: correoDestino,
    });

    if (error) {
      console.error('No se pudo reenviar el correo recibido:', error);
      return NextResponse.json(
        { error: 'Correo guardado, pero no se pudo reenviar' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      procesado: true,
      id: data?.id,
      email_id: evento.data.email_id,
    });
  } catch (error) {
    console.error('Webhook de Resend inválido:', error);
    return NextResponse.json(
      { error: 'Firma de webhook inválida' },
      { status: 400 }
    );
  }
}
