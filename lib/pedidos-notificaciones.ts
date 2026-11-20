import 'server-only';
import { Resend } from 'resend';
import type { ItemPedidoValidado } from '@/lib/pedidos';

type PedidoNotificable = {
  id: number;
  cliente: string;
  email: string;
  telefono: string;
  productos: ItemPedidoValidado[];
  total: number;
  fecha_retiro: string;
  hora_retiro: string;
  observaciones: string | null;
};

type CuentaTransferencia = {
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  titular: string;
  rut_titular: string | null;
  email_notificacion: string | null;
};

function escaparHtml(valor: unknown) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function dinero(valor: number) {
  return Math.round(valor).toLocaleString('es-CL');
}

export async function enviarNotificacionesPedido(
  pedido: PedidoNotificable,
  cuentaTransferencia?: CuentaTransferencia | null
) {
  if (!process.env.RESEND_API_KEY) {
    return { error: 'Correo de pedidos no configurado.' };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const productosHtml = pedido.productos
    .map(
      (producto) => `<li><strong>${escaparHtml(producto.nombre)}</strong><br />Cantidad: ${producto.cantidad}<br />${producto.tamano ? `Tamaño: ${escaparHtml(producto.tamano)}<br />` : ''}Precio unitario: $${dinero(producto.precio)}</li>`
    )
    .join('');
  const observaciones = pedido.observaciones
    ? `<p><strong>Observaciones:</strong> ${escaparHtml(pedido.observaciones)}</p>`
    : '';
  const datosTransferencia = cuentaTransferencia
    ? `<h2>Pago por transferencia</h2><p>Este sitio no realiza cobros en línea. Si vas a transferir, usa <strong>Pedido #${pedido.id}</strong> como referencia y envía tu comprobante por WhatsApp o al correo indicado.</p><ul><li><strong>Banco:</strong> ${escaparHtml(cuentaTransferencia.banco)}</li><li><strong>Tipo de cuenta:</strong> ${escaparHtml(cuentaTransferencia.tipo_cuenta)}</li><li><strong>Número de cuenta:</strong> ${escaparHtml(cuentaTransferencia.numero_cuenta)}</li><li><strong>Titular:</strong> ${escaparHtml(cuentaTransferencia.titular)}</li>${cuentaTransferencia.rut_titular ? `<li><strong>RUT:</strong> ${escaparHtml(cuentaTransferencia.rut_titular)}</li>` : ''}${cuentaTransferencia.email_notificacion ? `<li><strong>Correo para comprobante:</strong> ${escaparHtml(cuentaTransferencia.email_notificacion)}</li>` : ''}</ul>`
    : '';

  const administrador = await resend.emails.send({
    from: 'Panadería Maruxa <pedidos@panaderiamaruxa.cl>',
    to: ['panaderiamaruxa@hotmail.com'],
    subject: `Nuevo pedido Maruxa #${pedido.id}`,
    html: `<h1>Nuevo pedido recibido</h1><p><strong>Pedido:</strong> #${pedido.id}</p><p><strong>Cliente:</strong> ${escaparHtml(pedido.cliente)}</p><p><strong>Email:</strong> ${escaparHtml(pedido.email)}</p><p><strong>Teléfono:</strong> ${escaparHtml(pedido.telefono)}</p><p><strong>Retiro:</strong> ${escaparHtml(pedido.fecha_retiro)} a las ${escaparHtml(pedido.hora_retiro)}</p><h2>Productos</h2><ul>${productosHtml}</ul><p><strong>Total:</strong> $${dinero(pedido.total)}</p>${observaciones}`,
  });

  if (administrador.error) return { error: administrador.error.message };

  const cliente = await resend.emails.send({
    from: 'Panadería Maruxa <pedidos@panaderiamaruxa.cl>',
    to: [pedido.email],
    subject: 'Hemos recibido tu pedido en Panadería Maruxa',
    html: `<h1>¡Gracias por tu pedido!</h1><p>Hola ${escaparHtml(pedido.cliente)},</p><p>Recibimos tu pedido #${pedido.id}. Lo confirmaremos antes de comenzar su preparación.</p><p><strong>Retiro:</strong> ${escaparHtml(pedido.fecha_retiro)} a las ${escaparHtml(pedido.hora_retiro)}</p><p><strong>Total:</strong> $${dinero(pedido.total)}</p>${datosTransferencia}<p>Todos los pedidos se retiran en nuestro local.</p>`,
  });

  return { error: cliente.error?.message || null };
}
