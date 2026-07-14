import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

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

function codigoProductoBase(codigo: string) {
  return codigo.replace(/-(10|15|20|25)p$/i, '');
}

function etiquetaTamano(codigo: string) {
  const match = codigo.match(/-(10|15|20|25)p$/i);
  return match ? `${match[1]} personas` : null;
}

function fechaHoraChile(fecha: Date) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(fecha);

  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value || '';

  return {
    fecha: `${valor('year')}-${valor('month')}-${valor('day')}`,
    hora: `${valor('hour')}:${valor('minute')}`,
  };
}

function formatearTelefonoWhatsApp(valor: string | null | undefined) {
  const digitos = String(valor || '').replace(/\D/g, '');

  if (digitos.startsWith('56') && digitos.length === 11) {
    return `+56 ${digitos.slice(2, 3)} ${digitos.slice(3, 7)} ${digitos.slice(7)}`;
  }

  if (digitos.startsWith('56')) return `+${digitos}`;
  return digitos ? `+${digitos}` : '';
}

function escaparHtml(valor: string | number | null | undefined) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function enviarCorreoPedidoWhatsApp(pedido: any) {
  if (!resend) return null;

  const productosHtml = pedido.productos
    ?.map(
      (producto: any) => `
        <li>
          <strong>${escaparHtml(producto.nombre)}</strong><br/>
          Cantidad: ${escaparHtml(producto.cantidad)}<br/>
          Precio: $${Number(producto.precio || 0).toLocaleString('es-CL')}
        </li>
      `
    )
    .join('');

  const { error } = await resend.emails.send({
    from: 'Panadería Maruxa <pedidos@panaderiamaruxa.cl>',
    to: ['panaderiamaruxa@hotmail.com'],
    subject: `Nuevo pedido WhatsApp Maruxa #${pedido.id}`,
    html: `
      <h1>Nuevo pedido desde WhatsApp</h1>
      <p><strong>Pedido:</strong> #${escaparHtml(pedido.id)}</p>
      <p><strong>Cliente:</strong> ${escaparHtml(pedido.cliente)}</p>
      <p><strong>Teléfono:</strong> ${escaparHtml(pedido.telefono)}</p>
      <p><strong>Fecha recepción:</strong> ${escaparHtml(pedido.fecha_retiro)}</p>
      <p><strong>Hora recepción:</strong> ${escaparHtml(pedido.hora_retiro)}</p>
      <h2>Productos</h2>
      <ul>${productosHtml}</ul>
      <p><strong>Total:</strong> $${Number(pedido.total || 0).toLocaleString('es-CL')}</p>
      ${
        pedido.observaciones
          ? `<p><strong>Observaciones:</strong> ${escaparHtml(pedido.observaciones)}</p>`
          : ''
      }
    `,
  });

  return error?.message || null;
}

async function responderPedidoWhatsApp(telefono: string, pedidoId: string | number) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const destino = telefono.replace(/\D/g, '');

  if (!token || !phoneNumberId || !destino) return null;

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
          body: `Hola, recibimos tu pedido #${pedidoId} en Panadería Maruxa. Lo revisaremos y te confirmaremos disponibilidad, total y horario de retiro. Gracias por preferirnos.`,
        },
      }),
    }
  );

  if (respuesta.ok) return null;

  const detalle = await respuesta.text();
  return detalle || `Meta respondio ${respuesta.status}`;
}

async function enviarMensajeWhatsApp(telefono: string, mensaje: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const destino = telefono.replace(/\D/g, '');

  if (!token || !phoneNumberId || !destino) {
    return 'Falta token, phone number id o telefono destino.';
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

  if (respuesta.ok) return null;

  const detalle = await respuesta.text();
  const errorTexto = detalle || `Meta respondio ${respuesta.status}`;
  const errorPlantilla = await enviarPlantillaNotificacionWhatsApp(
    destino,
    mensaje
  );

  return errorPlantilla
    ? `${errorTexto}. Fallback plantilla: ${errorPlantilla}`
    : null;
}

async function enviarPlantillaNotificacionWhatsApp(
  destino: string,
  mensaje: string
) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_NOTIFICATION_TEMPLATE_NAME;
  const languageCode =
    process.env.WHATSAPP_NOTIFICATION_TEMPLATE_LANGUAGE || 'es_CL';

  if (!token || !phoneNumberId || !templateName) {
    return 'No hay plantilla de notificacion configurada.';
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
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: mensaje.slice(0, 900),
                },
              ],
            },
          ],
        },
      }),
    }
  );

  if (respuesta.ok) return null;

  const detalle = await respuesta.text();
  return detalle || `Meta respondio ${respuesta.status}`;
}

function resumenMensajeEntrante(mensaje: MensajeWhatsApp) {
  if (mensaje.type === 'order') {
    const cantidad = mensaje.order?.product_items?.length || 0;
    return `Carro recibido con ${cantidad} producto${cantidad === 1 ? '' : 's'}.`;
  }

  return `Mensaje tipo ${mensaje.type || 'desconocido'} recibido.`;
}

async function avisarAdministradores(
  admin: NonNullable<ReturnType<typeof crearAdmin>>,
  empresaId: string,
  datos: {
    telefono: string;
    nombre: string;
    resumen: string;
    pedidoId?: string | number | null;
  }
) {
  const { data: perfiles } = await admin
    .from('perfiles_usuario')
    .select(
      'id,nombre_visible,notificar_whatsapp,notificar_email,notificacion_whatsapp,notificacion_email'
    )
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .or('notificar_whatsapp.eq.true,notificar_email.eq.true');

  if (!perfiles?.length) return;

  const asunto = datos.pedidoId
    ? `Nuevo pedido WhatsApp Maruxa #${datos.pedidoId}`
    : 'Nuevo mensaje WhatsApp Maruxa';
  const texto = [
    datos.pedidoId
      ? `Nuevo pedido WhatsApp #${datos.pedidoId}`
      : 'Nuevo mensaje WhatsApp',
    `Cliente: ${datos.nombre}`,
    `Telefono: ${datos.telefono}`,
    `Detalle: ${datos.resumen}`,
    'Revisar en https://panaderiamaruxa.cl/admin/whatsapp',
  ].join('\n');

  const resultados = await Promise.all(
    perfiles.flatMap((perfil: any) => {
      const tareas: Promise<string | null>[] = [];

      if (perfil.notificar_whatsapp && perfil.notificacion_whatsapp) {
        tareas.push(
          enviarMensajeWhatsApp(perfil.notificacion_whatsapp, texto).then(
            (error) =>
              error
                ? `WhatsApp ${perfil.nombre_visible || perfil.id}: ${error}`
                : null
          )
        );
      }

      if (perfil.notificar_email && perfil.notificacion_email && resend) {
        tareas.push(
          resend.emails.send({
            from: 'Panaderia Maruxa <pedidos@panaderiamaruxa.cl>',
            to: [perfil.notificacion_email],
            subject: asunto,
            html: `
              <h1>${escaparHtml(asunto)}</h1>
              <p><strong>Cliente:</strong> ${escaparHtml(datos.nombre)}</p>
              <p><strong>Telefono:</strong> ${escaparHtml(datos.telefono)}</p>
              <p><strong>Detalle:</strong> ${escaparHtml(datos.resumen)}</p>
              <p><a href="https://panaderiamaruxa.cl/admin/whatsapp">Abrir Chat Meta</a></p>
            `,
          }).then(({ error }) =>
            error
              ? `Email ${perfil.nombre_visible || perfil.id}: ${error.message}`
              : null
          )
        );
      }

      return tareas;
    })
  );

  return resultados.filter(Boolean) as string[];
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
    let baseDatosEstado: number | null = null;
    let destinosWhatsappConfigurados = 0;

    if (admin) {
      const resultado = await admin
        .from('whatsapp_eventos')
        .select('id')
        .limit(1);
      const { count } = await admin
        .from('perfiles_usuario')
        .select('id', { count: 'exact', head: true })
        .eq('activo', true)
        .eq('notificar_whatsapp', true)
        .not('notificacion_whatsapp', 'is', null);
      baseDatosLista = !resultado.error;
      baseDatosEstado = resultado.status;
      baseDatosError = resultado.error
        ? JSON.stringify(resultado.error)
        : null;
      destinosWhatsappConfigurados = count || 0;
    }

    return NextResponse.json({
      webhook: 'whatsapp',
      disponible: true,
      tokenConfigurado: Boolean(tokenConfigurado),
      appSecretConfigurado: Boolean(process.env.WHATSAPP_APP_SECRET),
      plantillaNotificacionConfigurada: Boolean(
        process.env.WHATSAPP_NOTIFICATION_TEMPLATE_NAME
      ),
      idiomaPlantillaNotificacion:
        process.env.WHATSAPP_NOTIFICATION_TEMPLATE_LANGUAGE || 'es_CL',
      supabaseServidorConfigurado: Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
      baseDatosLista,
      baseDatosEstado,
      baseDatosError,
      destinosWhatsappConfigurados,
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
        telefono: formatearTelefonoWhatsApp(mensaje.from || contacto?.wa_id) || null,
        tipo: mensaje.type || 'desconocido',
        payload,
      };

      if (mensaje.type !== 'order' || !mensaje.order?.product_items?.length) {
        const { data: eventoMensaje } = await admin
          .from('whatsapp_eventos')
          .insert({
            ...eventoBase,
            estado: 'ignorado',
            observacion: 'El mensaje no corresponde a un carro de compra.',
          })
          .select('id,observacion')
          .single();

        const erroresAviso = await avisarAdministradores(admin, empresaId, {
          telefono: eventoBase.telefono || '',
          nombre: contacto?.profile?.name || `WhatsApp ${mensaje.from || ''}`,
          resumen: resumenMensajeEntrante(mensaje),
          pedidoId: null,
        });

        if (eventoMensaje?.id && erroresAviso.length > 0) {
          await admin
            .from('whatsapp_eventos')
            .update({
              observacion: [
                eventoMensaje.observacion,
                `Aviso administrador no enviado: ${erroresAviso.join(' | ')}`,
              ]
                .filter(Boolean)
                .join('\n'),
            })
            .eq('id', eventoMensaje.id);
        }

        continue;
      }

      const productosOrden = mensaje.order.product_items;
      const codigos = productosOrden
        .map((item) => item.product_retailer_id?.trim())
        .filter(Boolean) as string[];
      const codigosBase = codigos.map(codigoProductoBase);
      const idsFallback = codigos
        .map((codigo) => codigo.match(/^producto-(\d+)(?:-(?:10|15|20|25)p)?$/i)?.[1])
        .filter(Boolean) as string[];

      const productosPorCodigoQuery = codigosBase.length
        ? admin
            .from('productos')
            .select('id,codigo,nombre,imagen,precio')
            .eq('empresa_id', empresaId)
            .in('codigo', codigosBase)
        : Promise.resolve({ data: [] });

      const productosPorIdQuery = idsFallback.length
        ? admin
            .from('productos')
            .select('id,codigo,nombre,imagen,precio')
            .eq('empresa_id', empresaId)
            .in('id', idsFallback.map(Number))
        : Promise.resolve({ data: [] });

      const [{ data: productosPorCodigoDb }, { data: productosPorIdDb }] =
        await Promise.all([productosPorCodigoQuery, productosPorIdQuery]);

      const productosDb = [
        ...(productosPorCodigoDb || []),
        ...(productosPorIdDb || []),
      ];

      const productosPorCodigo = new Map(
        productosDb.flatMap((producto) => [
          [String(producto.codigo), producto],
          [`producto-${producto.id}`, producto],
          [`${producto.codigo}-10p`, producto],
          [`${producto.codigo}-15p`, producto],
          [`${producto.codigo}-20p`, producto],
          [`${producto.codigo}-25p`, producto],
          [`producto-${producto.id}-10p`, producto],
          [`producto-${producto.id}-15p`, producto],
          [`producto-${producto.id}-20p`, producto],
          [`producto-${producto.id}-25p`, producto],
        ])
      );

      const faltantes: string[] = [];
      const productosPedido = productosOrden.map((item) => {
        const codigo = item.product_retailer_id?.trim() || 'SIN-CODIGO';
        const producto = productosPorCodigo.get(codigo);
        const tamano = etiquetaTamano(codigo);
        const cantidad = Number(item.quantity || 0);
        const precioWhatsApp = Number(item.item_price || 0);

        if (!producto) faltantes.push(codigo);

        return {
          producto_id: producto?.id || null,
          codigo,
          nombre: producto
            ? `${producto.nombre}${tamano ? ` ${tamano}` : ''}`
            : `Producto WhatsApp ${codigo}`,
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
      const fechaHoraRecepcion = fechaHoraChile(fechaRecepcion);
      const telefonoCliente = formatearTelefonoWhatsApp(
        mensaje.from || contacto?.wa_id
      );
      const observacionesPedido = faltantes.length
        ? `Revisar codigos sin coincidencia: ${faltantes.join(', ')}`
        : 'Pedido recibido desde el carro de WhatsApp. Confirmar fecha y hora de retiro con el cliente.';

      const { data: pedido, error: errorPedido } = await admin
        .from('pedidos')
        .insert({
          empresa_id: empresaId,
          cliente: contacto?.profile?.name || `WhatsApp ${mensaje.from || ''}`,
          telefono: telefonoCliente,
          email: '',
          productos: productosPedido,
          total,
          fecha_retiro: fechaHoraRecepcion.fecha,
          hora_retiro: fechaHoraRecepcion.hora,
          observaciones: observacionesPedido,
          estado: 'pendiente',
          origen: 'whatsapp_carrito',
          whatsapp_message_id: mensaje.id,
          whatsapp_catalog_id: mensaje.order.catalog_id || null,
          whatsapp_payload: payload,
        })
        .select('id')
        .single();

      const errorCorreo =
        pedido && !errorPedido
          ? await enviarCorreoPedidoWhatsApp({
              ...pedido,
              cliente: contacto?.profile?.name || `WhatsApp ${mensaje.from || ''}`,
              telefono: telefonoCliente,
              productos: productosPedido,
              total,
              fecha_retiro: fechaHoraRecepcion.fecha,
              hora_retiro: fechaHoraRecepcion.hora,
              observaciones: observacionesPedido,
            })
          : null;
      const errorRespuesta =
        pedido && !errorPedido
          ? await responderPedidoWhatsApp(telefonoCliente, pedido.id)
          : null;

      const { data: eventoPedido } = await admin.from('whatsapp_eventos').insert({
        ...eventoBase,
        pedido_id: pedido?.id || null,
        estado: errorPedido
          ? 'error'
          : faltantes.length
            ? 'requiere_revision'
            : 'procesado',
        observacion:
          errorPedido?.message ||
          (errorCorreo
            ? `Pedido guardado, pero no se pudo enviar correo: ${errorCorreo}`
            : null) ||
          (errorRespuesta
            ? `Pedido guardado, pero no se pudo responder por WhatsApp: ${errorRespuesta}`
            : null) ||
          (faltantes.length
            ? `Códigos no encontrados: ${faltantes.join(', ')}`
            : null),
      }).select('id,observacion').single();

      if (pedido && !errorPedido) {
        const erroresAviso = await avisarAdministradores(admin, empresaId, {
          telefono: telefonoCliente,
          nombre: contacto?.profile?.name || `WhatsApp ${mensaje.from || ''}`,
          resumen: `Pedido recibido por $${Number(total || 0).toLocaleString('es-CL')}.`,
          pedidoId: pedido.id,
        });

        if (eventoPedido?.id && erroresAviso.length > 0) {
          await admin
            .from('whatsapp_eventos')
            .update({
              observacion: [
                eventoPedido.observacion,
                `Aviso administrador no enviado: ${erroresAviso.join(' | ')}`,
              ]
                .filter(Boolean)
                .join('\n'),
            })
            .eq('id', eventoPedido.id);
        }
      }
    }
  }

  return NextResponse.json({ recibido: true });
}
