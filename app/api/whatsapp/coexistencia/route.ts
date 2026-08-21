import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const META_APP_ID = '883388000861812';
const GRAPH_VERSION = 'v23.0';

function crearAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !url) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function soloDigitos(valor: unknown) {
  return String(valor || '').replace(/\D/g, '');
}

export async function POST(request: Request) {
  const admin = crearAdmin();
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const accessTokenSesion = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '');

  if (!admin || !appSecret) {
    return NextResponse.json(
      { error: 'La conexion con Meta no esta configurada en el servidor.' },
      { status: 503 }
    );
  }

  if (!accessTokenSesion) {
    return NextResponse.json({ error: 'Sesion requerida.' }, { status: 401 });
  }

  const { data: autenticacion } = await admin.auth.getUser(accessTokenSesion);
  if (!autenticacion.user) {
    return NextResponse.json({ error: 'Sesion invalida.' }, { status: 401 });
  }

  const { data: perfil } = await admin
    .from('perfiles_usuario')
    .select('activo,rol')
    .eq('id', autenticacion.user.id)
    .maybeSingle();

  if (!perfil?.activo || !String(perfil.rol || '').toLowerCase().includes('admin')) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  const cuerpo = await request.json().catch(() => null);
  const code = String(cuerpo?.code || '').trim();
  const wabaIdEvento = soloDigitos(cuerpo?.wabaId);
  const phoneNumberIdEvento = soloDigitos(cuerpo?.phoneNumberId);

  if (!code) {
    return NextResponse.json(
      { error: 'Meta no entrego el codigo temporal de autorizacion.' },
      { status: 400 }
    );
  }

  const urlToken = new URL(
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`
  );
  urlToken.searchParams.set('client_id', META_APP_ID);
  urlToken.searchParams.set('client_secret', appSecret);
  urlToken.searchParams.set('code', code);

  const respuestaToken = await fetch(urlToken, { cache: 'no-store' });
  const tokenMeta = await respuestaToken.json().catch(() => null);
  const accessTokenMeta = String(tokenMeta?.access_token || '');

  if (!respuestaToken.ok || !accessTokenMeta) {
    return NextResponse.json(
      { error: tokenMeta?.error?.message || 'Meta rechazo la autorizacion.' },
      { status: 502 }
    );
  }

  let wabaId = wabaIdEvento;
  let phoneNumberId = phoneNumberIdEvento;
  let telefono = '';

  if (wabaId) {
    const respuestaSuscripcion = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/subscribed_apps`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessTokenMeta}` },
        cache: 'no-store',
      }
    );
    const suscripcion = await respuestaSuscripcion.json().catch(() => null);

    if (!respuestaSuscripcion.ok) {
      return NextResponse.json(
        {
          error:
            suscripcion?.error?.message ||
            'No se pudo suscribir la cuenta al webhook.',
        },
        { status: 502 }
      );
    }

    const respuestaNumeros = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,status`,
      {
        headers: { Authorization: `Bearer ${accessTokenMeta}` },
        cache: 'no-store',
      }
    );
    const numerosMeta = await respuestaNumeros.json().catch(() => null);
    const numeros = Array.isArray(numerosMeta?.data) ? numerosMeta.data : [];
    const numero5041 = numeros.find((numero: any) =>
      soloDigitos(numero?.display_phone_number).endsWith('5041')
    );
    const numeroElegido =
      numero5041 ||
      numeros.find((numero: any) => String(numero?.id) === phoneNumberId) ||
      numeros[0];

    if (numeroElegido) {
      phoneNumberId = soloDigitos(numeroElegido.id);
      telefono = String(numeroElegido.display_phone_number || '');
    }
  }

  return NextResponse.json({
    ok: true,
    wabaId: wabaId || null,
    phoneNumberId: phoneNumberId || null,
    telefono: telefono || null,
    suscritoWebhook: Boolean(wabaId),
    siguientePaso:
      'Asignar la cuenta al usuario del sistema y configurar el canal secundario en Vercel.',
  });
}
