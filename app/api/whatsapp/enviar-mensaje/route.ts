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
    .select('activo')
    .eq('id', autenticacion.user.id)
    .maybeSingle();

  if (!perfil?.activo) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  const { telefono, mensaje } = await request.json();
  const destino = normalizarDestino(telefono);
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return NextResponse.json(
      { error: 'Variables de WhatsApp incompletas.' },
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

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    return NextResponse.json(
      { error: detalle || `Meta respondio ${respuesta.status}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
