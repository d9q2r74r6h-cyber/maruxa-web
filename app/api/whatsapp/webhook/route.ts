import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type ProductoWhatsApp = {
  product_retailer_id?: string;
  quantity?: string | number;
  item_price?: string | number;
  currency?: string;
};

type MensajeWhatsApp = {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  order?: {
    catalog_id?: string;
    product_items?: ProductoWhatsApp[];
  };
};

function firmaValida(cuerpo: string, firma: string | null) {
  const secreto = process.env.WHATSAPP_APP_SECRET;
  if (!secreto || !firma?.startsWith('sha256=')) return false;

  const esperada = createHmac('sha256', secreto)
    .update(cuerpo)
    .digest('hex');
  const recibida = firma.slice('sha256='.length);

  if (esperada.length !== recibida.length) return false;

  return timingSafeEqual(
    Buffer.from(esperada, 'hex'),
    Buffer.from(recibida, 'hex')
  );
}

function crearAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !url) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const modo = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const desafio = url.searchParams.get('hub.challenge');
  const tokenConfigurado = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (!modo && !token && !desafio) {
    const admin = crearAdmin();
    let baseDatosLista = false;
    let baseDatosError: string | null = admin ? null : 'Cliente Supabase no configurado.';

    if (admin) {
      const { error } = await admin
        .from('whatsapp_eventos')
        .select('id', { head: true, count: 'exact' });
      baseDatosLista = !error;
      baseDatosError = error?.message || null;
    }

    return NextResponse.json({
      webhook: 'whatsapp',
      disponible: true,
      tokenConfigurado: Boolean(tokenConfigurado),
      appSecretConfigurado: Boolean(process.env.WHATSAPP_APP_SECRET),
      supabaseServidorConfigurado: Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
      baseDatosLista,
      baseDatosError,
    });
  }

  if (
    modo === 'subscribe' &&
    token &&
    tokenConfigurado &&
    token.trim() === tokenConfigurado &&
    desafio
  ) {
    return new Response(desafio, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  return NextResponse.json({ error: 'Verificación inválida.' }, { status: 403 });
}

export async function POST(request: Request) {
  const cuerpo = await request.text();

  if (!firmaValida(cuerpo, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Firma inválida.' }, { status: 401 });
  }

  const admin = crearAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: 'Configuración de Supabase incompleta.' },
      { status: 503 }
    );
  }

  let payload: any;
  try {
    payload = JSON.parse(cuerpo);
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const empresaIdConfigurada = process.env.WHATSAPP_EMPRESA_ID;
  let empresaId = empresaIdConfigurada;

  if (!empresaId) {
    const { data: empresa } = await admin
      .from('empresas')
      .select('id')
      .eq('slug', 'maruxa')
      .eq('activo', true)
      .limit(1)
      .maybeSingle();
    empresaId = empresa?.id;
  }

  if (!empresaId) {
    return NextResponse.json(
      { error: 'No se pudo identificar la empresa receptora.' },
      { status: 503 }
    );
  }

  const cambios = (payload.entry || []).flatMap((entrada: any) =>
    (entrada.changes || []).map((cambio: any) => cambio.value)
  );

  for (const valor of cambios) {
    const contacto = valor.contacts?.[0];
    const mensajes = (valor.messages || []) as MensajeWhatsApp[];

    for (const mensaje of mensajes) {
      if (!mensaje.id) continue;

      const { data: existente } = await admin
        .from('whatsapp_eventos')
        .select('id')
        .eq('message_id', mensaje.id)
        .maybeSingle();

      if (existente) continue;

      const eventoBase = {
        empresa_id: empresaId,
        message_id: mensaje.id,
        telefono: mensaje.from || contacto?.wa_id || null,
        tipo: mensaje.type || 'desconocido',
        payload,
      };

      if (mensaje.type !== 'order' || !mensaje.order?.product_items?.length) {
        await admin.from('whatsapp_eventos').insert({
          ...eventoBase,
          estado: 'ignorado',
          observacion: 'El mensaje no corresponde a un carro de compra.',
        });
        continue;
      }

      const productosOrden = mensaje.order.product_items;
      const codigos = productosOrden
        .map((item) => item.product_retailer_id?.trim())
        .filter(Boolean) as string[];

      const { data: productosDb } = await admin
        .from('productos')
        .select('id,codigo,nombre,imagen,precio')
        .eq('empresa_id', empresaId)
        .in('codigo', codigos);

      const productosPorCodigo = new Map(
        (productosDb || []).map((producto) => [
          String(producto.codigo),
          producto,
        ])
      );

      const faltantes: string[] = [];
      const productosPedido = productosOrden.map((item) => {
        const codigo = item.product_retailer_id?.trim() || 'SIN-CODIGO';
        const producto = productosPorCodigo.get(codigo);
        const cantidad = Number(item.quantity || 0);
        const precioWhatsApp = Number(item.item_price || 0);

        if (!producto) faltantes.push(codigo);

        return {
          producto_id: producto?.id || null,
          codigo,
          nombre: producto?.nombre || `Producto WhatsApp ${codigo}`,
          cantidad,
          precio: precioWhatsApp || Number(producto?.precio || 0),
          imagen: producto?.imagen || null,
          origen_precio: precioWhatsApp ? 'whatsapp' : 'erp',
        };
      });

      const total = productosPedido.reduce(
        (suma, item) => suma + item.cantidad * item.precio,
        0
      );
      const fechaRecepcion = mensaje.timestamp
        ? new Date(Number(mensaje.timestamp) * 1000)
        : new Date();

      const { data: pedido, error: errorPedido } = await admin
        .from('pedidos')
        .insert({
          empresa_id: empresaId,
          cliente: contacto?.profile?.name || `WhatsApp ${mensaje.from || ''}`,
          telefono: mensaje.from || contacto?.wa_id || '',
          email: null,
          productos: productosPedido,
          total,
          fecha_retiro: fechaRecepcion.toISOString().slice(0, 10),
          hora_retiro: '00:00',
          observaciones: faltantes.length
            ? `Revisar códigos sin coincidencia: ${faltantes.join(', ')}`
            : 'Pedido recibido desde el carro de WhatsApp.',
          estado: 'pendiente',
          origen: 'whatsapp_carrito',
          whatsapp_message_id: mensaje.id,
          whatsapp_catalog_id: mensaje.order.catalog_id || null,
          whatsapp_payload: payload,
        })
        .select('id')
        .single();

      await admin.from('whatsapp_eventos').insert({
        ...eventoBase,
        pedido_id: pedido?.id || null,
        estado: errorPedido
          ? 'error'
          : faltantes.length
            ? 'requiere_revision'
            : 'procesado',
        observacion:
          errorPedido?.message ||
          (faltantes.length
            ? `Códigos no encontrados: ${faltantes.join(', ')}`
            : null),
      });
    }
  }

  return NextResponse.json({ recibido: true });
}
