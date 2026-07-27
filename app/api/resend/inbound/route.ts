import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const correoPublico = 'contacto@panaderiamaruxa.cl';
const correoDestino = 'panaderiamaruxa@hotmail.com';

function normalizarDireccion(valor: string) {
  const coincidencia = valor.match(/<([^>]+)>/);
  return (coincidencia?.[1] || valor).trim().toLowerCase();
}

export function GET() {
  return NextResponse.json({
    servicio: 'Resend Inbound',
    configurado: Boolean(
      process.env.RESEND_API_KEY && process.env.RESEND_WEBHOOK_SECRET
    ),
  });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (!apiKey || !webhookSecret) {
    console.error('Falta configurar Resend Inbound.');
    return NextResponse.json(
      { error: 'Servicio no configurado' },
      { status: 503 }
    );
  }

  const resend = new Resend(apiKey);
  const payload = await request.text();
  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');

  if (!id || !timestamp || !signature) {
    return NextResponse.json(
      { error: 'Faltan encabezados de firma' },
      { status: 400 }
    );
  }

  try {
    const evento = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    });

    if (evento.type !== 'email.received') {
      return NextResponse.json({ procesado: false });
    }

    const destinatarios = [
      ...evento.data.to,
      ...evento.data.cc,
      ...evento.data.bcc,
    ].map(normalizarDireccion);

    if (!destinatarios.includes(correoPublico)) {
      return NextResponse.json({
        procesado: false,
        motivo: 'Destinatario no configurado',
      });
    }

    const { data, error } = await resend.emails.receiving.forward({
      emailId: evento.data.email_id,
      from: `Panadería Maruxa <${correoPublico}>`,
      to: correoDestino,
    });

    if (error) {
      console.error('No se pudo reenviar el correo recibido:', error);
      return NextResponse.json(
        { error: 'No se pudo reenviar el correo' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      procesado: true,
      id: data?.id,
    });
  } catch (error) {
    console.error('Webhook de Resend inválido:', error);
    return NextResponse.json(
      { error: 'Firma de webhook inválida' },
      { status: 400 }
    );
  }
}
