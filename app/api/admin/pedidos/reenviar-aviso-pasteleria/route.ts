import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { obtenerCanalPedidosWhatsapp } from '@/lib/whatsapp-canales';
import { enviarPorWhatsapp, resolverPlantillaWhatsapp } from '@/lib/whatsapp-api';

function crearAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function digitos(valor: unknown) {
  return String(valor || '').replace(/\D/g, '');
}

export async function POST(request: Request) {
  const admin = crearAdmin();
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!admin || !token) {
    return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });
  }

  const { data: autenticacion } = await admin.auth.getUser(token);
  if (!autenticacion.user) {
    return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
  }
  const { data: perfil } = await admin
    .from('perfiles_usuario')
    .select('empresa_id,activo')
    .eq('id', autenticacion.user.id)
    .maybeSingle();
  if (!perfil?.activo) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  const cuerpo = await request.json().catch(() => ({}));
  const pedidoId = Number(cuerpo.pedidoId);
  if (!Number.isFinite(pedidoId)) {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  }

  const [{ data: pedido }, { data: funcionarios }] = await Promise.all([
    admin
      .from('pedidos')
      .select('id,cliente,telefono,productos,total,observaciones')
      .eq('empresa_id', perfil.empresa_id)
      .eq('id', pedidoId)
      .maybeSingle(),
    admin
      .from('funcionarios')
      .select('id,nombre_completo,telefono')
      .eq('empresa_id', perfil.empresa_id)
      .eq('activo', true)
      .eq('recibe_avisos_pedidos_whatsapp', true),
  ]);
  if (!pedido) {
    return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
  }

  const { data: clientes } = await admin
    .from('clientes')
    .select('razon_social,direccion,repartidor_nombre,telefono')
    .eq('empresa_id', perfil.empresa_id)
    .eq('activo', true);
  const telefonoPedido = digitos(pedido.telefono);
  const cliente = (clientes || []).find(
    (item: any) => digitos(item.telefono) === telefonoPedido
  );
  const canal = obtenerCanalPedidosWhatsapp();
  if (!canal) {
    return NextResponse.json(
      { error: 'El canal de pedidos 5041 no está configurado.' },
      { status: 503 }
    );
  }

  const productos = Array.isArray(pedido.productos) ? pedido.productos : [];
  const detalleProductos = productos
    .map((producto: any) => `${producto.cantidad} x ${producto.nombre}`)
    .join(', ')
    .slice(0, 700) || 'Sin productos detallados';
  const destinatarios = (funcionarios || []).filter((item: any) => digitos(item.telefono));
  if (!destinatarios.length) {
    return NextResponse.json(
      { error: 'No hay trabajadores seleccionados con teléfono configurado.' },
      { status: 400 }
    );
  }

  const nombrePlantilla =
    process.env.WHATSAPP_ORDER_NOTIFICATION_TEMPLATE_NAME ||
    'aviso_nuevo_mensaje_admin';
  const plantilla = await resolverPlantillaWhatsapp(
    canal,
    nombrePlantilla,
    process.env.WHATSAPP_ORDER_NOTIFICATION_TEMPLATE_LANGUAGE || 'en_US'
  );
  if (plantilla.encontrada === false) {
    return NextResponse.json(
      {
        error: `La plantilla ${nombrePlantilla} no existe en la WABA 1640388854109907. Debe crearse o duplicarse dentro de esa cuenta.`,
      },
      { status: 409 }
    );
  }

  let enviados = 0;
  const errores: string[] = [];
  for (const funcionario of destinatarios) {
    const valores = [
      funcionario.nombre_completo || 'Trabajador',
      String(pedido.id),
      cliente?.razon_social || pedido.cliente || 'Cliente no identificado',
      pedido.telefono || 'Sin teléfono',
      cliente?.direccion || 'Sin dirección registrada',
      cliente?.repartidor_nombre || 'Sin repartidor asignado',
      detalleProductos,
      `$${Number(pedido.total || 0).toLocaleString('es-CL')}`,
      pedido.observaciones || 'Sin observaciones',
    ];
    const { respuesta, data, texto } = await enviarPorWhatsapp(canal, {
      messaging_product: 'whatsapp',
      to: digitos(funcionario.telefono),
      type: 'template',
      template: {
        name: plantilla.nombre,
        language: {
          code: plantilla.idioma,
        },
        components: [
          {
            type: 'body',
            parameters: valores.map((text) => ({ type: 'text', text })),
          },
        ],
      },
    });
    if (respuesta.ok) {
      enviados += 1;
      await admin.from('whatsapp_eventos').insert({
        empresa_id: perfil.empresa_id,
        message_id: data?.messages?.[0]?.id || `reenvio-${crypto.randomUUID()}`,
        telefono: `+${digitos(funcionario.telefono)}`,
        tipo: 'aviso_administrador',
        estado: 'aceptado',
        observacion: `Pedido #${pedido.id} reenviado a ${funcionario.nombre_completo}.`,
        payload: {
          direccion: 'saliente',
          origen: 'reenvio_aviso_pedido',
          funcionario_id: funcionario.id,
          pedido_id: pedido.id,
          canal_phone_number_id: canal.phoneNumberId,
        },
      });
    } else {
      errores.push(
        `${funcionario.nombre_completo}: ${data?.error?.message || texto || `HTTP ${respuesta.status}`}`
      );
    }
  }

  return NextResponse.json({
    ok: errores.length === 0,
    enviados,
    errores,
    destinatarios: destinatarios.length,
  });
}
