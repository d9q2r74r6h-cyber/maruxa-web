import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import {
  obtenerCanalWhatsapp,
  obtenerCanalesWhatsapp,
} from '@/lib/whatsapp-canales';
import { enviarPorWhatsapp } from '@/lib/whatsapp-api';

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
  to?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  order?: {
    catalog_id?: string;
    product_items?: ProductoWhatsApp[];
  };
};

type ResultadoEnvioWhatsApp = {
  error: string | null;
  messageId: string | null;
  respuesta: any;
};

// Identificadores del catálogo histórico de WhatsApp. Meta conserva estos
// retailer IDs aunque el ERP haya adoptado una codificación nueva.
const PRODUCTOS_LEGACY_WHATSAPP: Record<string, number> = {
  T01: 9,
  T02: 10,
  PP01: 13,
  PP03: 15,
  PP04: 16,
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
  const normalizado = codigo.trim().toUpperCase();
  const codigoConPresentacion = normalizado.match(/^(PRO-[^-]+-\d+)(?:-.+)?$/i);
  if (codigoConPresentacion) return codigoConPresentacion[1];
  return normalizado.replace(/-?(10|15|20|25)p$/i, '');
}

function etiquetaTamano(codigo: string) {
  const normalizado = codigo.trim();
  const tamanoTorta = normalizado.match(/-?(10|15|20|25)p$/i);
  if (tamanoTorta) return `${tamanoTorta[1]} personas`;

  const presentacion = normalizado.match(/^PRO-[^-]+-\d+-(.+)$/i)?.[1];
  if (!presentacion) return null;

  const texto = presentacion.replace(/-/g, ' ').trim();
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : null;
}

function normalizarCodigoProducto(codigo: string) {
  return codigo.trim().toUpperCase();
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
      <p><strong>Dirección:</strong> ${escaparHtml(pedido.direccion || 'Sin dirección registrada')}</p>
      <p><strong>Repartidor:</strong> ${escaparHtml(pedido.repartidor || 'Sin repartidor asignado')}</p>
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

async function responderPedidoWhatsApp(
  telefono: string,
  pedidoId: string | number,
  phoneNumberId?: string | null
) {
  const canal = obtenerCanalWhatsapp(phoneNumberId);
  const destino = telefono.replace(/\D/g, '');

  if (!canal || !destino) return 'El numero receptor no esta configurado para responder.';

  const { respuesta, texto: detalle } = await enviarPorWhatsapp(canal, {
        messaging_product: 'whatsapp',
        to: destino,
        type: 'text',
        text: {
          preview_url: false,
          body: `Hola, recibimos tu pedido #${pedidoId} en Panadería Maruxa. Lo revisaremos y te confirmaremos disponibilidad, total y horario de retiro. Gracias por preferirnos.`,
        },
      });

  if (respuesta.ok) return null;

  return detalle || `Meta respondio ${respuesta.status}`;
}

async function enviarPlantillaNotificacionWhatsApp(
  destino: string,
  mensaje: string,
  phoneNumberIdPreferido?: string | null
): Promise<ResultadoEnvioWhatsApp> {
  const phoneNumberId =
    phoneNumberIdPreferido || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const canal = obtenerCanalWhatsapp(phoneNumberId);
  const telefonoDestino = destino.replace(/\D/g, '');
  const mensajePlantilla = mensaje
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 900);
  const templateName =
    (canal?.proveedor === '360dialog'
      ? process.env.WHATSAPP_360DIALOG_NOTIFICATION_TEMPLATE_NAME
      : null) ||
    process.env.WHATSAPP_NOTIFICATION_TEMPLATE_NAME ||
    'aviso_nuevo_mensaje_admin';
  const languageCode =
    (canal?.proveedor === '360dialog'
      ? process.env.WHATSAPP_360DIALOG_NOTIFICATION_TEMPLATE_LANGUAGE
      : null) ||
    process.env.WHATSAPP_NOTIFICATION_TEMPLATE_LANGUAGE ||
    'es_CL';

  if (
    !canal ||
    !telefonoDestino ||
    !templateName ||
    !mensajePlantilla
  ) {
    return {
      error: 'No hay plantilla de notificacion configurada.',
      messageId: null,
      respuesta: null,
    };
  }

  const { respuesta, data: respuestaMeta, texto: detalle } =
    await enviarPorWhatsapp(canal, {
        messaging_product: 'whatsapp',
        to: telefonoDestino,
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
                  text: mensajePlantilla,
                },
              ],
            },
          ],
        },
      });

  if (respuesta.ok) {
    return {
      error: null,
      messageId: respuestaMeta?.messages?.[0]?.id || null,
      respuesta: respuestaMeta,
    };
  }

  return {
    error: detalle || `Meta respondio ${respuesta.status}`,
    messageId: null,
    respuesta: respuestaMeta,
  };
}

async function enviarPlantillaPedidoTrabajador(
  destino: string,
  nombreTrabajador: string,
  pedido: {
    id: string | number;
    cliente: string;
    telefono: string;
    productos: Array<{ nombre: string; cantidad: number }>;
    total: number;
    observaciones?: string | null;
    direccion?: string | null;
    repartidor?: string | null;
  },
  phoneNumberIdPreferido?: string | null
): Promise<ResultadoEnvioWhatsApp> {
  const canal = obtenerCanalWhatsapp(
    phoneNumberIdPreferido || process.env.WHATSAPP_PHONE_NUMBER_ID
  );
  const telefonoDestino = destino.replace(/\D/g, '');
  if (!canal || !telefonoDestino) {
    return {
      error: 'No hay canal de WhatsApp configurado para avisar el pedido.',
      messageId: null,
      respuesta: null,
    };
  }

  const productos = pedido.productos
    .map((producto) => `${producto.cantidad} x ${producto.nombre}`)
    .join(', ')
    .slice(0, 700);
  const valores = [
    nombreTrabajador || 'Trabajador',
    String(pedido.id),
    pedido.cliente || 'Cliente no identificado',
    pedido.telefono || 'Sin teléfono',
    pedido.direccion || 'Sin dirección registrada',
    pedido.repartidor || 'Sin repartidor asignado',
    productos || 'Sin productos detallados',
    `$${Number(pedido.total || 0).toLocaleString('es-CL')}`,
    pedido.observaciones || 'Sin observaciones',
  ];
  const { respuesta, data, texto } = await enviarPorWhatsapp(canal, {
    messaging_product: 'whatsapp',
    to: telefonoDestino,
    type: 'template',
    template: {
      name:
        process.env.WHATSAPP_ORDER_NOTIFICATION_TEMPLATE_NAME ||
        'aviso_nuevo_mensaje_admin',
      language: {
        code:
          process.env.WHATSAPP_ORDER_NOTIFICATION_TEMPLATE_LANGUAGE || 'es_CL',
      },
      components: [
        {
          type: 'body',
          parameters: valores.map((text) => ({ type: 'text', text })),
        },
      ],
    },
  });

  return respuesta.ok
    ? {
        error: null,
        messageId: data?.messages?.[0]?.id || null,
        respuesta: data,
      }
    : {
        error: texto || `Meta respondió ${respuesta.status}`,
        messageId: null,
        respuesta: data,
      };
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
    phoneNumberId?: string | null;
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
          enviarPlantillaNotificacionWhatsApp(
            perfil.notificacion_whatsapp,
            texto,
            datos.phoneNumberId
          ).then(async (resultado) => {
            if (resultado.messageId) {
              const { error: errorRegistro } = await admin
                .from('whatsapp_eventos')
                .insert({
                  empresa_id: empresaId,
                  message_id: resultado.messageId,
                  telefono: formatearTelefonoWhatsApp(
                    perfil.notificacion_whatsapp
                  ),
                  tipo: 'aviso_administrador',
                  estado: 'aceptado',
                  observacion: 'Aviso aceptado por Meta; esperando estado de entrega.',
                  payload: {
                    direccion: 'saliente',
                    origen: 'aviso_administrador',
                    perfil_id: perfil.id,
                    meta: resultado.respuesta,
                  },
                });

              if (errorRegistro) {
                return `Registro aviso ${perfil.nombre_visible || perfil.id}: ${errorRegistro.message}`;
              }
            }

            return resultado.error
              ? `WhatsApp ${perfil.nombre_visible || perfil.id}: ${resultado.error}`
              : null;
          })
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

async function avisarResponsablesPedido(
  admin: NonNullable<ReturnType<typeof crearAdmin>>,
  empresaId: string,
  pedido: {
    id: string | number;
    cliente: string;
    telefono: string;
    productos: Array<{ nombre: string; cantidad: number }>;
    total: number;
    observaciones?: string | null;
    direccion?: string | null;
    repartidor?: string | null;
  },
  phoneNumberId?: string | null
) {
  const { data: funcionarios, error } = await admin
    .from('funcionarios')
    .select('id,nombre_completo,telefono,email')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .eq('recibe_avisos_pedidos_whatsapp', true);

  if (error) return [`No se pudieron consultar destinatarios de pedidos: ${error.message}`];

  const destinatarios = new Map<string, any>();
  for (const funcionario of funcionarios || []) {
    const telefono = String(funcionario.telefono || '').replace(/\D/g, '');
    const email = String(funcionario.email || '').trim().toLowerCase();
    if (telefono || email) destinatarios.set(String(funcionario.id), funcionario);
  }

  if (!destinatarios.size) {
    return ['No hay trabajadores seleccionados para recibir pedidos con teléfono o correo configurado.'];
  }

  const detalleProductos = pedido.productos
    .map((producto) => `${producto.cantidad} x ${producto.nombre}`)
    .join(', ');
  const texto = [
    `Nuevo pedido de pastelería #${pedido.id}`,
    `Cliente: ${pedido.cliente}`,
    `Teléfono: ${pedido.telefono}`,
    `Dirección: ${pedido.direccion || 'Sin dirección registrada'}`,
    `Repartidor: ${pedido.repartidor || 'Sin repartidor asignado'}`,
    `Productos: ${detalleProductos}`,
    `Total: $${Number(pedido.total || 0).toLocaleString('es-CL')}`,
    pedido.observaciones ? `Observaciones: ${pedido.observaciones}` : null,
    'Revisar: https://panaderiamaruxa.cl/admin/pedidos',
  ]
    .filter(Boolean)
    .join('\n');

  const resultados = await Promise.all(
    Array.from(destinatarios.values()).map(async (funcionario) => {
      const telefono = String(funcionario.telefono || '').replace(/\D/g, '');
      const email = String(funcionario.email || '').trim().toLowerCase();
      const nombreCompleto = String(funcionario.nombre_completo || 'Trabajador').trim();
      const resultado = telefono
        ? await enviarPlantillaPedidoTrabajador(
            telefono,
            nombreCompleto,
            pedido,
            phoneNumberId
          )
        : { error: null, messageId: null, respuesta: null };

      if (resultado.messageId) {
        await admin.from('whatsapp_eventos').insert({
          empresa_id: empresaId,
          message_id: resultado.messageId,
          telefono: formatearTelefonoWhatsApp(telefono),
          tipo: 'aviso_administrador',
          estado: 'aceptado',
          observacion: `Pedido #${pedido.id} enviado a ${funcionario.nombre_completo}.`,
          payload: {
            direccion: 'saliente',
            origen: 'aviso_pedido',
            funcionario_id: funcionario.id,
            pedido_id: pedido.id,
            meta: resultado.respuesta,
          },
        });
      }

      let errorCorreo: string | null = null;
      if (email && resend) {
        const productosHtml = pedido.productos
          .map(
            (producto) =>
              `<li><strong>${escaparHtml(producto.cantidad)} x ${escaparHtml(producto.nombre)}</strong></li>`
          )
          .join('');
        const { error: errorEnvio } = await resend.emails.send({
          from: 'Panadería Maruxa <pedidos@panaderiamaruxa.cl>',
          to: [email],
          subject: `Nuevo pedido de pastelería #${pedido.id} — ${pedido.cliente}`,
          html: `
            <p>Hola ${escaparHtml(nombreCompleto)},</p>
            <p>Se recibió un nuevo pedido de pastelería.</p>
            <p><strong>Pedido:</strong> #${escaparHtml(pedido.id)}</p>
            <p><strong>Razón social:</strong> ${escaparHtml(pedido.cliente)}</p>
            <p><strong>Teléfono:</strong> ${escaparHtml(pedido.telefono)}</p>
            <p><strong>Dirección:</strong> ${escaparHtml(pedido.direccion || 'Sin dirección registrada')}</p>
            <p><strong>Repartidor:</strong> ${escaparHtml(pedido.repartidor || 'Sin repartidor asignado')}</p>
            <h2>Productos</h2>
            <ul>${productosHtml}</ul>
            <p><strong>Total:</strong> $${Number(pedido.total || 0).toLocaleString('es-CL')}</p>
            ${pedido.observaciones ? `<p><strong>Observaciones:</strong> ${escaparHtml(pedido.observaciones)}</p>` : ''}
            <p><a href="https://panaderiamaruxa.cl/admin/pedidos">Abrir pedidos</a></p>
          `,
        });
        errorCorreo = errorEnvio?.message || null;
      } else if (email && !resend) {
        errorCorreo = 'Resend no está configurado.';
      } else {
        errorCorreo = 'No tiene correo configurado.';
      }

      const errores = [
        resultado.error ? `WhatsApp: ${resultado.error}` : null,
        errorCorreo ? `Email: ${errorCorreo}` : null,
      ].filter(Boolean);
      return errores.length ? `${nombreCompleto}: ${errores.join(' | ')}` : null;
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
    const canalesConfigurados = obtenerCanalesWhatsapp();
    const tokenPrincipal = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || null;
    const tokenSecundario =
      process.env.WHATSAPP_SECONDARY_ACCESS_TOKEN?.trim() || null;
    let permisosTokenSecundario: string[] = [];
    let permisosTokenSecundarioError: number | null = null;

    if (tokenSecundario) {
      try {
        const respuestaPermisos = await fetch(
          'https://graph.facebook.com/v26.0/me/permissions',
          {
            headers: { Authorization: `Bearer ${tokenSecundario}` },
            cache: 'no-store',
          }
        );
        const detallePermisos = await respuestaPermisos.json().catch(() => null);
        permisosTokenSecundario = Array.isArray(detallePermisos?.data)
          ? detallePermisos.data
              .filter((permiso: any) => permiso?.status === 'granted')
              .map((permiso: any) => String(permiso.permission))
          : [];
        permisosTokenSecundarioError =
          Number(detallePermisos?.error?.code) || null;
      } catch {
        permisosTokenSecundarioError = -1;
      }
    }
    const canales = await Promise.all(
      canalesConfigurados.map(async (canal) => {
        let accesoMeta: boolean | null = null;
        let estadoMeta: number | null = null;
        let codigoMeta: number | null = null;

        if (canal.proveedor === 'meta') {
          try {
            const respuestaMeta = await fetch(
              `https://graph.facebook.com/v26.0/${canal.phoneNumberId}?fields=id,display_phone_number,verified_name`,
              {
                headers: { Authorization: `Bearer ${canal.accessToken}` },
                cache: 'no-store',
              }
            );
            estadoMeta = respuestaMeta.status;
            accesoMeta = respuestaMeta.ok;
            const detalleMeta = await respuestaMeta.json().catch(() => null);
            codigoMeta = Number(detalleMeta?.error?.code) || null;
          } catch {
            accesoMeta = false;
          }
        }

        return {
          phoneNumberId: canal.phoneNumberId,
          telefonoVisible: canal.telefonoVisible,
          etiqueta: canal.etiqueta,
          proveedor: canal.proveedor,
          accesoMeta,
          estadoMeta,
          codigoMeta,
        };
      })
    );
    let baseDatosLista = false;
    let baseDatosError: string | null = admin ? null : 'Cliente Supabase no configurado.';
    let baseDatosEstado: number | null = null;
    let destinosWhatsappConfigurados = 0;
    let ultimoRecordatorio: {
      desde: string;
      total: number;
      estados: Record<string, number>;
      plantilla: string | null;
      ultimoEnvio: string | null;
    } | null = null;

    if (admin) {
      const resultado = await admin
        .from('whatsapp_eventos')
        .select('id')
        .limit(1);
      const { data: ultimosAvisos } = await admin
        .from('whatsapp_eventos')
        .select('created_at,telefono,estado,observacion,message_id')
        .eq('tipo', 'aviso_administrador')
        .order('created_at', { ascending: false })
        .limit(5);
      const { count } = await admin
        .from('perfiles_usuario')
        .select('id', { count: 'exact', head: true })
        .eq('activo', true)
        .eq('notificar_whatsapp', true)
        .not('notificacion_whatsapp', 'is', null);
      const desdeRecordatorios = new Date(
        Date.now() - 6 * 60 * 60 * 1000
      ).toISOString();
      const { data: recordatoriosRecientes } = await admin
        .from('whatsapp_eventos')
        .select('created_at,estado,payload')
        .eq('tipo', 'recordatorio_cliente')
        .gte('created_at', desdeRecordatorios)
        .order('created_at', { ascending: false })
        .limit(500);
      const estadosRecordatorios = (recordatoriosRecientes || []).reduce(
        (acumulado: Record<string, number>, evento: any) => {
          const estado = String(evento.estado || 'desconocido').toLowerCase();
          acumulado[estado] = (acumulado[estado] || 0) + 1;
          return acumulado;
        },
        {}
      );
      ultimoRecordatorio = {
        desde: desdeRecordatorios,
        total: recordatoriosRecientes?.length || 0,
        estados: estadosRecordatorios,
        plantilla: recordatoriosRecientes?.[0]?.payload?.plantilla || null,
        ultimoEnvio: recordatoriosRecientes?.[0]?.created_at || null,
      };
      baseDatosLista = !resultado.error;
      baseDatosEstado = resultado.status;
      baseDatosError = resultado.error
        ? JSON.stringify(resultado.error)
        : null;
      destinosWhatsappConfigurados = count || 0;

      return NextResponse.json({
        webhook: 'whatsapp',
        disponible: true,
        tokenConfigurado: Boolean(tokenConfigurado),
        appSecretConfigurado: Boolean(process.env.WHATSAPP_APP_SECRET),
        tokenSecundarioConfigurado: Boolean(tokenSecundario),
        tokenSecundarioReutilizaPrincipal:
          Boolean(tokenSecundario) && tokenSecundario === tokenPrincipal,
        permisosTokenSecundario,
        permisosTokenSecundarioError,
        secreto360Configurado: Boolean(
          process.env.WHATSAPP_360DIALOG_WEBHOOK_SECRET?.trim()
        ),
        canales,
        plantillaNotificacionConfigurada: true,
        plantillaNotificacionNombre:
          process.env.WHATSAPP_NOTIFICATION_TEMPLATE_NAME ||
          'aviso_nuevo_mensaje_admin',
        idiomaPlantillaNotificacion:
          process.env.WHATSAPP_NOTIFICATION_TEMPLATE_LANGUAGE || 'es_CL',
        supabaseServidorConfigurado: Boolean(
          process.env.SUPABASE_SERVICE_ROLE_KEY
        ),
        baseDatosLista,
        baseDatosEstado,
        baseDatosError,
        destinosWhatsappConfigurados,
        ultimoRecordatorio,
        ultimosAvisos: ultimosAvisos || [],
      });
    }

    return NextResponse.json({
      webhook: 'whatsapp',
      disponible: true,
      tokenConfigurado: Boolean(tokenConfigurado),
      appSecretConfigurado: Boolean(process.env.WHATSAPP_APP_SECRET),
      secreto360Configurado: Boolean(
        process.env.WHATSAPP_360DIALOG_WEBHOOK_SECRET?.trim()
      ),
      canales,
      plantillaNotificacionConfigurada: true,
      plantillaNotificacionNombre:
        process.env.WHATSAPP_NOTIFICATION_TEMPLATE_NAME ||
        'aviso_nuevo_mensaje_admin',
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
  const secreto360 = process.env.WHATSAPP_360DIALOG_WEBHOOK_SECRET?.trim();
  const token360 = new URL(request.url).searchParams.get('d360_token')?.trim();
  const autorizado360 = Boolean(
    secreto360 && token360 && secreto360 === token360
  );

  if (
    !autorizado360 &&
    !firmaValida(cuerpo, request.headers.get('x-hub-signature-256'))
  ) {
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
    const estados = valor.statuses || [];

    for (const estado of estados) {
      if (!estado.id) continue;

      const errores = (estado.errors || [])
        .map((error: any) =>
          [error.code, error.title, error.message, error.error_data?.details]
            .filter(Boolean)
            .join(' - ')
        )
        .filter(Boolean);
      const observacion = errores.length
        ? `Meta marcó el mensaje como ${estado.status}: ${errores.join(' | ')}`
        : `Meta marcó el mensaje como ${estado.status}.`;

      const { data: eventoSaliente } = await admin
        .from('whatsapp_eventos')
        .select('id,payload')
        .eq('message_id', estado.id)
        .maybeSingle();

      if (!eventoSaliente) continue;

      await admin
        .from('whatsapp_eventos')
        .update({
          estado: estado.status || 'actualizado',
          observacion,
          payload: {
            ...(eventoSaliente.payload || {}),
            direccion: 'saliente',
            canal_phone_number_id: valor.metadata?.phone_number_id || null,
            canal_telefono: valor.metadata?.display_phone_number || null,
            estado_meta: estado,
          },
        })
        .eq('id', eventoSaliente.id);
    }

    const contacto = valor.contacts?.[0];
    const ecos = (valor.message_echoes || []) as MensajeWhatsApp[];

    for (const eco of ecos) {
      if (!eco.id) continue;

      const { data: existente } = await admin
        .from('whatsapp_eventos')
        .select('id')
        .eq('message_id', eco.id)
        .maybeSingle();

      if (existente) continue;

      await admin.from('whatsapp_eventos').insert({
        empresa_id: empresaId,
        message_id: eco.id,
        telefono: formatearTelefonoWhatsApp(eco.to) || null,
        tipo: 'respuesta',
        estado: 'enviado',
        observacion:
          eco.text?.body || `Mensaje ${eco.type || 'desconocido'} enviado desde WhatsApp Business.`,
        payload: {
          direccion: 'saliente',
          origen: 'whatsapp_business_app',
          canal_phone_number_id: valor.metadata?.phone_number_id || null,
          eco,
        },
      });
    }

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
      const codigosBase = [...new Set(codigos.map(codigoProductoBase))];
      const idsFallback = [
        ...codigos
          .map((codigo) => codigo.match(/^producto-(\d+)(?:-(?:10|15|20|25)p)?$/i)?.[1])
          .filter(Boolean)
          .map(Number),
        ...codigosBase
          .map((codigo) => PRODUCTOS_LEGACY_WHATSAPP[codigo])
          .filter((id): id is number => Boolean(id)),
      ];

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
            .in('id', [...new Set(idsFallback)])
        : Promise.resolve({ data: [] });

      const [{ data: productosPorCodigoDb }, { data: productosPorIdDb }] =
        await Promise.all([productosPorCodigoQuery, productosPorIdQuery]);

      const productosDb = [
        ...(productosPorCodigoDb || []),
        ...(productosPorIdDb || []),
      ];

      const productosPorCodigo = new Map<string, (typeof productosDb)[number]>();
      for (const producto of productosDb) {
        const codigoDb = normalizarCodigoProducto(String(producto.codigo || ''));
        if (codigoDb) productosPorCodigo.set(codigoDb, producto);
        productosPorCodigo.set(`PRODUCTO-${producto.id}`, producto);
      }
      for (const [codigoLegacy, productoId] of Object.entries(PRODUCTOS_LEGACY_WHATSAPP)) {
        const producto = productosDb.find((item) => Number(item.id) === productoId);
        if (producto) productosPorCodigo.set(codigoLegacy, producto);
      }

      const faltantes: string[] = [];
      const productosPedido = productosOrden.map((item) => {
        const codigo = item.product_retailer_id?.trim() || 'SIN-CODIGO';
        const codigoNormalizado = normalizarCodigoProducto(codigo);
        const producto =
          productosPorCodigo.get(codigoNormalizado) ||
          productosPorCodigo.get(codigoProductoBase(codigoNormalizado));
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
      const telefonoClienteDigitos = telefonoCliente.replace(/\D/g, '');
      const { data: clientesRegistrados } = await admin
        .from('clientes')
        .select('id,razon_social,direccion,repartidor_nombre,telefono')
        .eq('empresa_id', empresaId)
        .eq('activo', true);
      const clienteRegistrado = (clientesRegistrados || []).find(
        (cliente: any) =>
          String(cliente.telefono || '').replace(/\D/g, '') === telefonoClienteDigitos
      );
      const nombreCliente =
        clienteRegistrado?.razon_social ||
        contacto?.profile?.name ||
        `WhatsApp ${mensaje.from || ''}`;
      const direccionCliente = clienteRegistrado?.direccion || null;
      const repartidorCliente = clienteRegistrado?.repartidor_nombre || null;
      const observacionesPedido = faltantes.length
        ? `Revisar codigos sin coincidencia: ${faltantes.join(', ')}`
        : 'Pedido recibido desde el carro de WhatsApp. Confirmar fecha y hora de retiro con el cliente.';

      const { data: pedido, error: errorPedido } = await admin
        .from('pedidos')
        .insert({
          empresa_id: empresaId,
          cliente: nombreCliente,
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
              cliente: nombreCliente,
              telefono: telefonoCliente,
              direccion: direccionCliente,
              repartidor: repartidorCliente,
              productos: productosPedido,
              total,
              fecha_retiro: fechaHoraRecepcion.fecha,
              hora_retiro: fechaHoraRecepcion.hora,
              observaciones: observacionesPedido,
            })
          : null;
      const errorRespuesta =
        pedido && !errorPedido
          ? await responderPedidoWhatsApp(
              telefonoCliente,
              pedido.id,
              valor.metadata?.phone_number_id
            )
          : null;
      const erroresPasteleros =
        pedido && !errorPedido
          ? await avisarResponsablesPedido(
              admin,
              empresaId,
              {
                id: pedido.id,
                cliente: nombreCliente,
                telefono: telefonoCliente,
                productos: productosPedido,
                total,
                observaciones: observacionesPedido,
                direccion: direccionCliente,
                repartidor: repartidorCliente,
              },
              valor.metadata?.phone_number_id
            )
          : [];

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
          (erroresPasteleros.length
            ? `Aviso a pastelería pendiente: ${erroresPasteleros.join(' | ')}`
            : null) ||
          (faltantes.length
            ? `Códigos no encontrados: ${faltantes.join(', ')}`
            : null),
      }).select('id,observacion').single();

      if (pedido && !errorPedido) {
        const erroresAviso = await avisarAdministradores(admin, empresaId, {
          telefono: telefonoCliente,
          nombre: nombreCliente,
          resumen: `Pedido recibido por $${Number(total || 0).toLocaleString('es-CL')}.`,
          pedidoId: pedido.id,
          phoneNumberId: valor.metadata?.phone_number_id,
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
