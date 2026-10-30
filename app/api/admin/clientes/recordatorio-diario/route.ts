import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { obtenerCanalPedidosWhatsapp } from '@/lib/whatsapp-canales';
import { enviarPorWhatsapp } from '@/lib/whatsapp-api';

const PLANTILLA = 'recordatorio_pedido_manana_catalogo';
const ZONA_HORARIA = 'America/Santiago';
export const maxDuration = 60;

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

function momentoChile() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value || '';
  return {
    fecha: `${valor('year')}-${valor('month')}-${valor('day')}`,
    dia: valor('weekday'),
    hora: Number(valor('hour')),
  };
}

function fechaMananaChile() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
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

function autorizado(request: Request) {
  const secreto = process.env.CRON_SECRET;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return Boolean(secreto && token === secreto);
}

export async function GET(request: Request) {
  const admin = crearAdmin();
  if (!admin) return NextResponse.json({ error: 'Supabase no está configurado.' }, { status: 503 });
  const url = new URL(request.url);
  const forzar = url.searchParams.get('forzar') === '1';
  let empresaId: string | null = null;

  if (forzar) {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });
    const { data: autenticacion } = await admin.auth.getUser(token);
    if (!autenticacion.user) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
    const { data: perfil } = await admin
      .from('perfiles_usuario')
      .select('empresa_id,activo,rol')
      .eq('id', autenticacion.user.id)
      .maybeSingle();
    if (!perfil?.activo || !String(perfil.rol || '').toLowerCase().includes('admin')) {
      return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
    }
    empresaId = perfil.empresa_id;
  } else if (!autorizado(request)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const momento = momentoChile();
  const fechaEntrega = fechaMananaChile();
  if (!forzar && (momento.hora !== 19 || momento.dia === 'Sat')) {
    return NextResponse.json({
      ok: true,
      omitido: true,
      motivo: 'Fuera del horario de domingo a viernes a las 19:00 de Santiago.',
      momento,
    });
  }

  const canal = obtenerCanalPedidosWhatsapp();
  if (!canal) return NextResponse.json({ error: 'El canal de pedidos 5041 no está configurado.' }, { status: 503 });

  const desde = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  let consultaClientes = admin
      .from('clientes')
      .select('id,empresa_id,razon_social,sigla,telefono')
      .eq('activo', true)
      .eq('whatsapp_pedidos_autorizado', true)
      .eq('whatsapp_recordatorio_diario', true)
      .not('telefono', 'is', null)
      .order('razon_social');
  let consultaEventos = admin
      .from('whatsapp_eventos')
      .select('empresa_id,payload,estado')
      .eq('tipo', 'recordatorio_cliente')
      .gte('created_at', desde);
  if (empresaId) {
    consultaClientes = consultaClientes.eq('empresa_id', empresaId);
    consultaEventos = consultaEventos.eq('empresa_id', empresaId);
  }
  const [{ data: clientes, error: errorClientes }, { data: eventos, error: errorEventos }] = await Promise.all([
    consultaClientes,
    consultaEventos,
  ]);
  if (errorClientes || errorEventos) {
    return NextResponse.json({ error: errorClientes?.message || errorEventos?.message }, { status: 500 });
  }

  const enviadosHoy = new Set(
    (eventos || [])
      .filter((evento: any) =>
        evento.payload?.fecha_local === momento.fecha &&
        evento.payload?.cliente_id &&
        evento.payload?.canal_phone_number_id === canal.phoneNumberId &&
        ['aceptado', 'sent', 'delivered', 'read'].includes(String(evento.estado || '').toLowerCase())
      )
      .map((evento: any) => `${evento.empresa_id}:${evento.payload.cliente_id}`)
  );
  const telefonosVistos = new Set<string>();
  let enviados = 0;
  let yaEnviados = 0;
  let invalidos = 0;
  let duplicados = 0;
  let errores = 0;

  for (const cliente of clientes || []) {
    const clave = `${cliente.empresa_id}:${cliente.id}`;
    if (enviadosHoy.has(clave)) {
      yaEnviados += 1;
      continue;
    }
    const destino = telefono(cliente.telefono);
    if (!/^569\d{8}$/.test(destino)) {
      invalidos += 1;
      continue;
    }
    if (telefonosVistos.has(destino)) {
      duplicados += 1;
      continue;
    }
    telefonosVistos.add(destino);

    const nombre = String(cliente.sigla || cliente.razon_social || 'Cliente').trim().split(/\s+/)[0];
    const payload = {
      messaging_product: 'whatsapp',
      to: destino,
      type: 'template',
      template: {
        name: PLANTILLA,
        language: { code: 'es_CL' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: nombre },
              { type: 'text', text: fechaEntrega },
            ],
          },
          {
            type: 'button',
            sub_type: 'CATALOG',
            index: '0',
          },
        ],
      },
    };

    try {
      let resultado = await enviarPorWhatsapp(canal, payload);
      for (let intento = 1; intento <= 2 && (resultado.respuesta.status === 429 || resultado.respuesta.status >= 500); intento += 1) {
        await new Promise((resolver) => setTimeout(resolver, intento * 2000));
        resultado = await enviarPorWhatsapp(canal, payload);
      }
      const { respuesta, data, texto } = resultado;
      const messageId = data?.messages?.[0]?.id || `recordatorio-error-${crypto.randomUUID()}`;
      const detalleError = [
        data?.error?.message,
        data?.error?.error_data?.details,
        data?.error?.details,
        texto,
      ].filter(Boolean).join(' - ');
      const detalle = respuesta.ok
        ? `Recordatorio diario enviado a ${cliente.razon_social}.`
        : `HTTP ${respuesta.status}: ${detalleError || 'Error desconocido'}`;
      await admin.from('whatsapp_eventos').insert({
        empresa_id: cliente.empresa_id,
        message_id: messageId,
        telefono: `+${destino}`,
        tipo: 'recordatorio_cliente',
        estado: respuesta.ok ? 'aceptado' : 'error',
        observacion: detalle,
        payload: {
          direccion: 'saliente',
          origen: 'recordatorio_diario',
          cliente_id: cliente.id,
          plantilla: PLANTILLA,
          canal_phone_number_id: canal.phoneNumberId,
          fecha_local: momento.fecha,
          fecha_entrega: fechaEntrega,
        },
      });
      if (respuesta.ok) enviados += 1;
      else errores += 1;
    } catch (errorEnvio) {
      errores += 1;
      await admin.from('whatsapp_eventos').insert({
        empresa_id: cliente.empresa_id,
        message_id: `recordatorio-error-${crypto.randomUUID()}`,
        telefono: `+${destino}`,
        tipo: 'recordatorio_cliente',
        estado: 'error',
        observacion: errorEnvio instanceof Error ? errorEnvio.message : 'Error de conexión con WhatsApp.',
        payload: {
          direccion: 'saliente',
          origen: 'recordatorio_diario',
          cliente_id: cliente.id,
          plantilla: PLANTILLA,
          canal_phone_number_id: canal.phoneNumberId,
          fecha_local: momento.fecha,
          fecha_entrega: fechaEntrega,
        },
      });
    }
    await new Promise((resolver) => setTimeout(resolver, 750));
  }

  return NextResponse.json({
    ok: errores === 0,
    manual: forzar,
    fecha: momento.fecha,
    enviados,
    yaEnviados,
    duplicados,
    invalidos,
    errores,
  });
}
