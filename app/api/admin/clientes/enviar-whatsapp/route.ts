import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { obtenerCanalPedidosWhatsapp } from '@/lib/whatsapp-canales';
import { enviarPorWhatsapp } from '@/lib/whatsapp-api';

const PLANTILLAS = new Set([
  'pedidos_catalogo_dia_siguiente',
  'recordatorio_pedido_manana_catalogo',
]);

function crearAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function telefono(valor: string | null | undefined) {
  const digitos = String(valor || '').replace(/\D/g, '');
  return digitos.length === 9 && digitos.startsWith('9') ? `56${digitos}` : digitos;
}

function fechaMananaChile() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value || '';
  const manana = new Date(
    Date.UTC(Number(valor('year')), Number(valor('month')) - 1, Number(valor('day')) + 1, 12)
  );
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(manana).replace(',', '');
}

export async function POST(request: Request) {
  const admin = crearAdmin();
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!admin || !token) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });

  const { data: autenticacion } = await admin.auth.getUser(token);
  if (!autenticacion.user) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
  const { data: perfil } = await admin.from('perfiles_usuario').select('empresa_id,activo').eq('id', autenticacion.user.id).maybeSingle();
  if (!perfil?.activo) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });

  const cuerpo = await request.json();
  const { data: cliente } = await admin
    .from('clientes')
    .select('id,razon_social,sigla,telefono,whatsapp_pedidos_autorizado')
    .eq('id', cuerpo.clienteId)
    .eq('empresa_id', perfil.empresa_id)
    .maybeSingle();
  if (!cliente?.whatsapp_pedidos_autorizado) return NextResponse.json({ error: 'El cliente no autorizó mensajes de WhatsApp.' }, { status: 400 });

  const destino = telefono(cliente.telefono);
  if (!/^569[0-9]{8}$/.test(destino)) return NextResponse.json({ error: 'El teléfono del cliente no es válido.' }, { status: 400 });
  const canal = obtenerCanalPedidosWhatsapp();
  if (!canal) return NextResponse.json({ error: 'El canal de pedidos 5041 no está configurado.' }, { status: 503 });

  let payload: Record<string, unknown>;
  let tipoEvento: string;
  let descripcion: string;

  if (cuerpo.tipo === 'libre') {
    const mensaje = String(cuerpo.mensaje || '').trim();
    if (!mensaje) return NextResponse.json({ error: 'El mensaje está vacío.' }, { status: 400 });
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: eventos } = await admin
      .from('whatsapp_eventos')
      .select('telefono,payload')
      .eq('empresa_id', perfil.empresa_id)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(1000);
    const ventanaActiva = (eventos || []).some((evento: any) =>
      telefono(evento.telefono) === destino && evento.payload?.direccion !== 'saliente'
    );
    if (!ventanaActiva) return NextResponse.json({ error: 'No existe una conversación iniciada por el cliente durante las últimas 24 horas. Usa una plantilla aprobada.' }, { status: 400 });
    payload = { messaging_product: 'whatsapp', to: destino, type: 'text', text: { preview_url: true, body: mensaje } };
    tipoEvento = 'mensaje_cliente';
    descripcion = mensaje;
  } else {
    const plantilla = String(cuerpo.plantilla || '');
    if (!PLANTILLAS.has(plantilla)) return NextResponse.json({ error: 'Plantilla no permitida.' }, { status: 400 });
    const nombre = String(cliente.sigla || cliente.razon_social || 'Cliente').trim().split(/\s+/)[0];
    const components: Record<string, unknown>[] = [];
    if (plantilla === 'pedidos_catalogo_dia_siguiente') {
      components.push({
        type: 'header',
        parameters: [{ type: 'image', image: { link: 'https://panaderiamaruxa.cl/logo-maruxa-meta.png' } }],
      });
    }
    const parametrosCuerpo: Record<string, unknown>[] = [{ type: 'text', text: nombre }];
    if (plantilla === 'recordatorio_pedido_manana_catalogo') {
      parametrosCuerpo.push({ type: 'text', text: fechaMananaChile() });
    }
    components.push({ type: 'body', parameters: parametrosCuerpo });
    if (plantilla === 'recordatorio_pedido_manana_catalogo') {
      components.push({
        type: 'button',
        sub_type: 'CATALOG',
        index: '0',
      });
    }
    payload = {
      messaging_product: 'whatsapp',
      to: destino,
      type: 'template',
      template: {
        name: plantilla,
        language: { code: 'es_CL' },
        components,
      },
    };
    tipoEvento = 'plantilla_cliente';
    descripcion = `Plantilla ${plantilla} enviada a ${cliente.razon_social}.`;
  }

  const { respuesta, data, texto } = await enviarPorWhatsapp(canal, payload);
  const messageId = data?.messages?.[0]?.id || `mensaje-error-${crypto.randomUUID()}`;
  const detalleError = [
    data?.error?.message,
    data?.error?.error_data?.details,
    data?.error?.details,
    texto,
  ].filter(Boolean).join(' - ');
  const error = respuesta.ok ? null : detalleError || `HTTP ${respuesta.status}`;
  await admin.from('whatsapp_eventos').insert({
    empresa_id: perfil.empresa_id,
    message_id: messageId,
    telefono: `+${destino}`,
    tipo: tipoEvento,
    estado: respuesta.ok ? 'aceptado' : 'error',
    observacion: error || descripcion,
    payload: { direccion: 'saliente', origen: 'mensaje_individual', cliente_id: cliente.id, plantilla: cuerpo.plantilla || null },
  });
  if (!respuesta.ok) return NextResponse.json({ error }, { status: respuesta.status });
  return NextResponse.json({ ok: true, messageId });
}
