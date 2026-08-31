import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  totalPedido,
  validarItemPedido,
  validarRetiro,
  type ItemPedidoEntrada,
  type ProductoPedidoFuente,
} from '@/lib/pedidos';
import { enviarNotificacionesPedido } from '@/lib/pedidos-notificaciones';

function texto(valor: unknown, maximo: number) {
  return String(valor || '').trim().slice(0, maximo);
}

function crearAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: Request) {
  const admin = crearAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: 'Servidor de pedidos no configurado.' },
      { status: 503 }
    );
  }

  const cuerpo = await request.json().catch(() => null);
  const cliente = texto(cuerpo?.cliente, 120);
  const email = texto(cuerpo?.email, 180).toLowerCase();
  const telefono = texto(cuerpo?.telefono, 30);
  const fechaRetiro = texto(cuerpo?.fecha_retiro, 10);
  const horaRetiro = texto(cuerpo?.hora_retiro, 5);
  const observaciones = texto(cuerpo?.observaciones, 1000);
  const sitioWeb = texto(cuerpo?.sitio_web, 200);
  const entradas = Array.isArray(cuerpo?.items)
    ? (cuerpo.items as ItemPedidoEntrada[])
    : [];

  if (
    sitioWeb ||
    !cliente ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    telefono.replace(/\D/g, '').length < 8 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fechaRetiro) ||
    !/^\d{2}:\d{2}$/.test(horaRetiro) ||
    entradas.length < 1 ||
    entradas.length > 50
  ) {
    return NextResponse.json(
      { error: 'Revisa los datos del pedido.' },
      { status: 400 }
    );
  }

  const ids = [
    ...new Set(
      entradas.map((item) => Number(item.id)).filter(Number.isSafeInteger)
    ),
  ];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Pedido sin productos.' }, { status: 400 });
  }

  // Primera fase: conserva la empresa actual, pero toda la lectura queda
  // aislada por empresa. La resolución dinámica por dominio será el siguiente corte.
  const { data: empresa } = await admin
    .from('empresas')
    .select('id')
    .eq('slug', 'maruxa')
    .eq('activo', true)
    .maybeSingle();
  if (!empresa) {
    return NextResponse.json({ error: 'Empresa no disponible.' }, { status: 503 });
  }

  const { data: productos, error: errorProductos } = await admin
    .from('productos')
    .select('id,nombre,precio,precio_10,precio_15,precio_20,precio_25,imagen')
    .eq('empresa_id', empresa.id)
    .eq('activo', true)
    .eq('tipo_producto', 'producto')
    .in('id', ids);
  if (errorProductos) {
    return NextResponse.json({ error: 'No se pudieron validar los productos.' }, { status: 500 });
  }

  const productosPorId = new Map(
    ((productos || []) as ProductoPedidoFuente[]).map((producto) => [
      producto.id,
      producto,
    ])
  );

  try {
    const items = entradas.map((entrada) => {
      const producto = productosPorId.get(Number(entrada.id));
      if (!producto) throw new Error('Uno de los productos ya no está disponible.');
      return validarItemPedido(entrada, producto);
    });
    const hoyChile = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    validarRetiro(
      fechaRetiro,
      horaRetiro,
      hoyChile,
      items.some((item) => Boolean(item.tamano))
    );
    const total = totalPedido(items);

    const { data: pedido, error } = await admin
      .from('pedidos')
      .insert({
        empresa_id: empresa.id,
        cliente,
        email,
        telefono,
        productos: items,
        total,
        fecha_retiro: fechaRetiro,
        hora_retiro: horaRetiro,
        observaciones: observaciones || null,
        estado: 'pendiente',
        origen: 'web',
      })
      .select('*')
      .single();

    if (error || !pedido) {
      return NextResponse.json(
        { error: 'No se pudo registrar el pedido.' },
        { status: 500 }
      );
    }

    const notificacion = await enviarNotificacionesPedido(pedido);
    return NextResponse.json({
      pedido,
      advertencia: notificacion.error
        ? 'El pedido fue guardado, pero falló una notificación.'
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pedido inválido.' },
      { status: 400 }
    );
  }
}
