import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const pedido = await request.json();
    
    const productosHtml = pedido.productos
      ?.map(
        (producto: any) => `
          <li>
            <strong>${producto.nombre}</strong><br/>
            Cantidad: ${producto.cantidad}<br/>
            ${producto.tamano ? `Tamaño: ${producto.tamano}<br/>` : ''}
            Precio: $${Number(producto.precio).toLocaleString('es-CL')}
          </li>
        `
      )
      .join('');

    const { error } = await resend.emails.send({
      from: 'Panadería Maruxa <pedidos@panaderiamaruxa.cl>',
      to: ['panaderiamaruxa@hotmail.com'],
      subject: `Nuevo pedido Maruxa #${pedido.id}`,
      html: `
        <h1>Nuevo pedido recibido</h1>

        <p><strong>Pedido:</strong> #${pedido.id}</p>
        <p><strong>Cliente:</strong> ${pedido.cliente}</p>
        <p><strong>Email:</strong> ${pedido.email}</p>
        <p><strong>Teléfono:</strong> ${pedido.telefono}</p>

        <h2>Retiro</h2>
        <p><strong>Fecha:</strong> ${pedido.fecha_retiro}</p>
        <p><strong>Hora:</strong> ${pedido.hora_retiro}</p>

        <h2>Productos</h2>
        <ul>${productosHtml}</ul>

        <p><strong>Total:</strong> $${Number(pedido.total).toLocaleString('es-CL')}</p>

        ${
          pedido.observaciones
            ? `<p><strong>Observaciones:</strong> ${pedido.observaciones}</p>`
            : ''
        }
      `,
    });

    if (error) {
      return Response.json({ error }, { status: 500 });
    }

    const { error: errorCliente } = await resend.emails.send({
      from: 'Panadería Maruxa <pedidos@panaderiamaruxa.cl>',
      to: [pedido.email],
      subject: 'Hemos recibido tu pedido en Panadería Maruxa 🍞',
      html: `
        <h1>¡Gracias por tu compra!</h1>

        <p>Hola ${pedido.cliente},</p>

        <p>
          Hemos recibido correctamente tu pedido y comenzaremos a prepararlo.
        </p>

        <h2>Resumen</h2>

        <p><strong>Pedido:</strong> #${pedido.id}</p>

        <p>
          <strong>Fecha retiro:</strong>
          ${pedido.fecha_retiro}
        </p>

        <p>
          <strong>Hora retiro:</strong>
          ${pedido.hora_retiro}
        </p>

        <p>
          <strong>Total:</strong>
          $${Number(pedido.total).toLocaleString('es-CL')}
        </p>

        <hr />

        <p>
          Todos los pedidos se retiran en nuestro local.
        </p>

        <p>
          WhatsApp: +56 9 8623 2447
        </p>

        <p>
          Gracias por preferir Panadería Maruxa.
        </p>
      `,
    });

    if (errorCliente) {
      return Response.json(
        { error: errorCliente },
        { status: 500 }
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
