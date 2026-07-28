import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const correoPublico = 'contacto@panaderiamaruxa.cl';

function crearAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !url) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function normalizarCorreo(valor: unknown) {
  const correo = String(valor || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ? correo : '';
}

export async function POST(request: Request) {
  const admin = crearAdmin();
  const apiKey = process.env.RESEND_API_KEY;
  const token = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '');

  if (!admin || !apiKey) {
    return NextResponse.json(
      { error: 'Servidor de correo no configurado.' },
      { status: 503 }
    );
  }

  if (!token) {
    return NextResponse.json({ error: 'Sesion requerida.' }, { status: 401 });
  }

  const { data: autenticacion } = await admin.auth.getUser(token);
  if (!autenticacion.user) {
    return NextResponse.json({ error: 'Sesion invalida.' }, { status: 401 });
  }

  const { data: perfil } = await admin
    .from('perfiles_usuario')
    .select('activo,empresa_id,nombre_visible')
    .eq('id', autenticacion.user.id)
    .maybeSingle();

  if (!perfil?.activo || !perfil.empresa_id) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  const cuerpo = await request.json().catch(() => ({}));
  const destino = normalizarCorreo(cuerpo.destino);
  const mensaje = String(cuerpo.mensaje || '').trim();
  const asuntoBase = String(cuerpo.asunto || '').trim() || '(Sin asunto)';
  const asunto = /^re:/i.test(asuntoBase) ? asuntoBase : `Re: ${asuntoBase}`;
  const idsPendientes = Array.isArray(cuerpo.idsPendientes)
    ? cuerpo.idsPendientes.filter((id: unknown) => typeof id === 'string')
    : [];
  const messageIdAnterior = String(cuerpo.messageIdAnterior || '').trim();

  if (!destino || !mensaje) {
    return NextResponse.json(
      { error: 'Destino y mensaje son requeridos.' },
      { status: 400 }
    );
  }

  const resend = new Resend(apiKey);
  const headers: Record<string, string> = {};
  if (messageIdAnterior) {
    headers['In-Reply-To'] = messageIdAnterior;
    headers.References = messageIdAnterior;
  }

  const { data, error } = await resend.emails.send({
    from: `Panadería Maruxa <${correoPublico}>`,
    to: [destino],
    subject: asunto,
    text: mensaje,
    replyTo: correoPublico,
    headers,
  });

  if (error || !data?.id) {
    return NextResponse.json(
      { error: error?.message || 'No se pudo enviar el correo.' },
      { status: 502 }
    );
  }

  if (idsPendientes.length > 0) {
    await admin
      .from('correo_eventos')
      .update({ estado: 'respondido' })
      .eq('empresa_id', perfil.empresa_id)
      .in('id', idsPendientes);
  }

  const { error: errorRegistro } = await admin.from('correo_eventos').insert({
    empresa_id: perfil.empresa_id,
    email_id: data.id,
    message_id: data.id,
    remitente: correoPublico,
    destinatarios: [destino],
    asunto,
    texto: mensaje,
    direccion: 'saliente',
    estado: 'enviado',
    respondido_a: messageIdAnterior || null,
    enviado_por: perfil.nombre_visible || autenticacion.user.email || null,
    payload: { origen: 'admin' },
  });

  if (errorRegistro) {
    return NextResponse.json(
      {
        error: `Correo enviado, pero no se pudo guardar en la bandeja: ${errorRegistro.message}`,
        enviado: true,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, email_id: data.id });
}
