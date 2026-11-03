import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { obtenerCanalPedidosWhatsapp } from '@/lib/whatsapp-canales';
import { enviarPorWhatsapp } from '@/lib/whatsapp-api';

const RESPUESTA_PUBLICA = {
  ok: true,
  mensaje:
    'Si existe una cuenta activa con un teléfono WhatsApp registrado, enviaremos un enlace temporal para restablecer la contraseña.',
};

function normalizarTelefono(valor: string | null | undefined) {
  return String(valor || '').replace(/\D/g, '');
}

function ventanaActual() {
  const fecha = new Date();
  fecha.setSeconds(0, 0);
  fecha.setMinutes(Math.floor(fecha.getMinutes() / 10) * 10);
  return fecha.toISOString();
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const templateName = process.env.WHATSAPP_PASSWORD_RECOVERY_TEMPLATE_NAME;
  const templateLanguage =
    process.env.WHATSAPP_PASSWORD_RECOVERY_TEMPLATE_LANGUAGE || 'es_CL';

  if (!url || !serviceRoleKey || !templateName) {
    return NextResponse.json(RESPUESTA_PUBLICA);
  }

  let email = '';
  try {
    const cuerpo = await request.json();
    email = String(cuerpo?.email || '').trim().toLowerCase();
  } catch {
    return NextResponse.json(RESPUESTA_PUBLICA);
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json(RESPUESTA_PUBLICA);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  // La plantilla de recuperación está aprobada en la cuenta de pedidos.
  // No usar el primer canal disponible: puede pertenecer a otro WABA y Meta
  // rechaza una plantilla que no exista en esa cuenta.
  const canal = obtenerCanalPedidosWhatsapp();
  if (!canal) return NextResponse.json(RESPUESTA_PUBLICA);

  const { data: usuarios } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const usuario = usuarios?.users.find(
    (item) => item.email?.toLowerCase() === email
  );
  if (!usuario) return NextResponse.json(RESPUESTA_PUBLICA);

  const { data: perfil } = await admin
    .from('perfiles_usuario')
    .select('id,empresa_id,funcionario_id,nombre_visible,activo')
    .eq('id', usuario.id)
    .maybeSingle();
  if (!perfil?.activo) return NextResponse.json(RESPUESTA_PUBLICA);

  let funcionario = perfil.funcionario_id
    ? (
        await admin
          .from('funcionarios')
          .select('id,nombre_completo,telefono,activo')
          .eq('id', perfil.funcionario_id)
          .eq('empresa_id', perfil.empresa_id)
          .maybeSingle()
      ).data
    : null;

  if (!funcionario) {
    funcionario = (
      await admin
        .from('funcionarios')
        .select('id,nombre_completo,telefono,activo')
        .eq('empresa_id', perfil.empresa_id)
        .ilike('email', email)
        .maybeSingle()
    ).data;
  }

  const destino = normalizarTelefono(funcionario?.telefono);
  if (!funcionario?.activo || !destino) return NextResponse.json(RESPUESTA_PUBLICA);

  const ventana = ventanaActual();
  const { error: errorReserva } = await admin
    .from('recuperaciones_password_whatsapp')
    .insert({
      auth_user_id: usuario.id,
      empresa_id: perfil.empresa_id,
      funcionario_id: funcionario.id,
      telefono: `+${destino}`,
      ventana_10_minutos: ventana,
      estado: 'procesando',
    });

  if (errorReserva) return NextResponse.json(RESPUESTA_PUBLICA);

  const { data: enlace, error: errorEnlace } =
    await admin.auth.admin.generateLink({ type: 'recovery', email });
  const token = enlace?.properties?.hashed_token;
  if (errorEnlace || !token) {
    await admin
      .from('recuperaciones_password_whatsapp')
      .update({ estado: 'fallido', detalle: errorEnlace?.message || 'No se pudo generar el enlace.' })
      .eq('auth_user_id', usuario.id)
      .eq('ventana_10_minutos', ventana);
    return NextResponse.json(RESPUESTA_PUBLICA);
  }

  const { respuesta, data: meta, texto: detalle } = await enviarPorWhatsapp(canal, {
    messaging_product: 'whatsapp',
    to: destino,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLanguage },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: funcionario.nombre_completo || perfil.nombre_visible }],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: token }],
        },
      ],
    },
  });

  await admin
    .from('recuperaciones_password_whatsapp')
    .update({
      estado: respuesta.ok ? 'enviado' : 'fallido',
      message_id: meta?.messages?.[0]?.id || null,
      detalle: respuesta.ok ? null : meta?.error?.message || detalle || `WhatsApp respondió ${respuesta.status}`,
    })
    .eq('auth_user_id', usuario.id)
    .eq('ventana_10_minutos', ventana);

  return NextResponse.json(RESPUESTA_PUBLICA);
}
