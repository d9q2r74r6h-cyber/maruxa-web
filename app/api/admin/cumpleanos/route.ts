import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

type Funcionario = {
  id: string;
  empresa_id: string;
  nombre_completo: string;
  email: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  ultimo_saludo_cumpleanos: number | null;
};

function crearAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !url) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function fechaChile() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value || '';

  return {
    anio: Number(valor('year')),
    mesDia: `${valor('month')}-${valor('day')}`,
  };
}

function mesDia(fecha: string | null) {
  return fecha ? fecha.slice(5, 10) : '';
}

function destinoWhatsapp(telefono: string | null) {
  return String(telefono || '').replace(/\D/g, '');
}

async function enviarWhatsApp(telefono: string | null, mensaje: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const destino = destinoWhatsapp(telefono);

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
          body: mensaje,
        },
      }),
    }
  );

  return respuesta.ok ? null : await respuesta.text();
}

function escaparHtml(texto: string) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function enviarEmail(destino: string | null, asunto: string, mensaje: string) {
  if (!resend || !destino) return null;

  const { error } = await resend.emails.send({
    from: 'Panaderia Maruxa <pedidos@panaderiamaruxa.cl>',
    to: [destino],
    subject: asunto,
    html: `<p>${escaparHtml(mensaje).replace(/\n/g, '<br />')}</p>`,
  });

  return error?.message || null;
}

function autorizado(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return true;

  const url = new URL(request.url);
  const tokenQuery = url.searchParams.get('token');
  const tokenHeader = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '');

  return tokenQuery === secreto || tokenHeader === secreto;
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const admin = crearAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: 'Supabase servidor no configurado.' },
      { status: 503 }
    );
  }

  const hoy = fechaChile();
  const { data, error } = await admin
    .from('funcionarios')
    .select(
      'id,empresa_id,nombre_completo,email,telefono,fecha_nacimiento,ultimo_saludo_cumpleanos'
    )
    .eq('activo', true)
    .not('fecha_nacimiento', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const funcionarios = (data || []) as Funcionario[];
  const cumpleaneros = funcionarios.filter(
    (funcionario) =>
      mesDia(funcionario.fecha_nacimiento) === hoy.mesDia &&
      Number(funcionario.ultimo_saludo_cumpleanos || 0) !== hoy.anio
  );

  const resultados = [];

  for (const cumpleanero of cumpleaneros) {
    const companeros = funcionarios.filter(
      (funcionario) =>
        funcionario.empresa_id === cumpleanero.empresa_id &&
        funcionario.id !== cumpleanero.id
    );
    const saludo = `Feliz cumpleanos, ${cumpleanero.nombre_completo}! Te deseamos un excelente dia de parte de Panaderia Maruxa.`;
    const aviso = `Hoy es el cumpleanos de ${cumpleanero.nombre_completo}. No olvidemos saludarle y hacerle sentir parte importante del equipo.`;

    const errores = [
      await enviarWhatsApp(cumpleanero.telefono, saludo),
      await enviarEmail(cumpleanero.email, 'Feliz cumpleanos', saludo),
    ].filter(Boolean);

    for (const companero of companeros) {
      const erroresCompanero = [
        await enviarWhatsApp(companero.telefono, aviso),
        await enviarEmail(companero.email, 'Cumpleanos en el equipo Maruxa', aviso),
      ].filter(Boolean);
      errores.push(...erroresCompanero);
    }

    await admin
      .from('funcionarios')
      .update({ ultimo_saludo_cumpleanos: hoy.anio })
      .eq('id', cumpleanero.id);

    resultados.push({
      funcionario_id: cumpleanero.id,
      nombre: cumpleanero.nombre_completo,
      avisos_companeros: companeros.length,
      errores,
    });
  }

  return NextResponse.json({
    fecha: hoy.mesDia,
    cumpleanos: resultados.length,
    resultados,
  });
}
