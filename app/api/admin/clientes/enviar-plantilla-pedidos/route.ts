import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { obtenerCanalesWhatsapp } from '@/lib/whatsapp-canales';
import { enviarPorWhatsapp } from '@/lib/whatsapp-api';

function crearAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function normalizarTelefono(valor: string | null | undefined) {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (digitos.length === 9 && digitos.startsWith('9')) return `56${digitos}`;
  return digitos;
}

export async function POST(request: Request) {
  const admin = crearAdmin();
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!admin || !token) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });

  const { data: autenticacion } = await admin.auth.getUser(token);
  if (!autenticacion.user) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });

  const { data: perfil } = await admin
    .from('perfiles_usuario')
    .select('empresa_id,activo')
    .eq('id', autenticacion.user.id)
    .maybeSingle();
  if (!perfil?.activo) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });

  const { clienteId } = await request.json();
  const { data: cliente } = await admin
    .from('clientes')
    .select('id,razon_social,sigla,telefono,whatsapp_pedidos_autorizado')
    .eq('id', clienteId)
    .eq('empresa_id', perfil.empresa_id)
    .maybeSingle();

  if (!cliente?.whatsapp_pedidos_autorizado) {
    return NextResponse.json({ error: 'El cliente no autorizó mensajes de pedidos.' }, { status: 400 });
  }

  const destino = normalizarTelefono(cliente.telefono);
  if (destino.length < 11) return NextResponse.json({ error: 'El teléfono del cliente no es válido.' }, { status: 400 });

  const canal = obtenerCanalesWhatsapp().find((item) => item.proveedor === '360dialog');
  if (!canal) return NextResponse.json({ error: 'El canal 360dialog no está configurado.' }, { status: 503 });

  const nombre = String(cliente.sigla || cliente.razon_social || 'Cliente').trim().split(/\s+/)[0];
  const plantilla = 'pedidos_catalogo_dia_siguiente';
  const { respuesta, data, texto } = await enviarPorWhatsapp(canal, {
    messaging_product: 'whatsapp',
    to: destino,
    type: 'template',
    template: {
      name: plantilla,
      language: { code: 'es_CL' },
      components: [
        {
          type: 'header',
          parameters: [{ type: 'image', image: { link: 'https://panaderiamaruxa.cl/logo-maruxa-meta.png' } }],
        },
        { type: 'body', parameters: [{ type: 'text', text: nombre }] },
      ],
    },
  });

  const messageId = data?.messages?.[0]?.id || null;
  await admin.from('whatsapp_eventos').insert({
    empresa_id: perfil.empresa_id,
    message_id: messageId,
    telefono: `+${destino}`,
    tipo: 'plantilla_cliente',
    estado: respuesta.ok ? 'aceptado' : 'error',
    observacion: respuesta.ok
      ? `Plantilla ${plantilla} enviada a ${cliente.razon_social}.`
      : data?.error?.message || texto,
    payload: { direccion: 'saliente', origen: 'campana_clientes', cliente_id: cliente.id, plantilla },
  });

  if (!respuesta.ok) {
    return NextResponse.json({ error: data?.error?.message || texto || '360dialog rechazó el envío.' }, { status: respuesta.status });
  }
  return NextResponse.json({ ok: true, messageId });
}
