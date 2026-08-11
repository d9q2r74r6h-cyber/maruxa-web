import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { obtenerCanalWhatsapp } from '@/lib/whatsapp-canales';

function normalizarTelefono(valor: string | null) {
  return String(valor || '').replace(/\D/g, '');
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Servicio no configurado.' }, { status: 503 });

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: autenticacion } = await admin.auth.getUser(token);
  if (!autenticacion.user) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });

  const { data: perfil } = await admin.from('perfiles_usuario').select('empresa_id,nombre_visible,activo').eq('id', autenticacion.user.id).maybeSingle();
  if (!perfil?.activo) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });

  const cuerpo = await request.json();
  const funcionarioId = String(cuerpo.funcionario_id || '');
  const mensaje = String(cuerpo.mensaje || '').trim().slice(0, 1000);
  if (!funcionarioId || !mensaje) return NextResponse.json({ error: 'Funcionario y mensaje son requeridos.' }, { status: 400 });

  const { data: funcionario } = await admin
    .from('funcionarios')
    .select('id,nombre_completo,telefono,activo')
    .eq('id', funcionarioId)
    .eq('empresa_id', perfil.empresa_id)
    .maybeSingle();
  if (!funcionario?.activo) return NextResponse.json({ error: 'El funcionario no está disponible.' }, { status: 404 });

  const destino = normalizarTelefono(funcionario.telefono);
  if (!destino) return NextResponse.json({ error: `${funcionario.nombre_completo} no tiene teléfono registrado.` }, { status: 400 });

  const canal = obtenerCanalWhatsapp();
  if (!canal) return NextResponse.json({ error: 'El canal de WhatsApp no está configurado.' }, { status: 503 });

  const respuesta = await fetch(`https://graph.facebook.com/v20.0/${canal.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${canal.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: destino, type: 'text', text: { preview_url: false, body: mensaje } }),
  });
  const meta = await respuesta.json().catch(() => null);
  if (!respuesta.ok) return NextResponse.json({ error: meta?.error?.message || `WhatsApp rechazó el envío (${respuesta.status}).` }, { status: 502 });

  const messageId = meta?.messages?.[0]?.id || `alerta-${Date.now()}`;
  await admin.from('whatsapp_eventos').insert({
    empresa_id: perfil.empresa_id,
    message_id: messageId,
    telefono: destino,
    tipo: 'alerta_funcionario',
    estado: 'enviado',
    observacion: mensaje,
    payload: {
      direccion: 'saliente', origen: 'centro_alertas', funcionario_id: funcionario.id,
      destinatario: funcionario.nombre_completo, enviado_por: perfil.nombre_visible || autenticacion.user.email || null,
      canal_phone_number_id: canal.phoneNumberId, meta,
    },
  });

  return NextResponse.json({ ok: true, destinatario: funcionario.nombre_completo, message_id: messageId });
}
