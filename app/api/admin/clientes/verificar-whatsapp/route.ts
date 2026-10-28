import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function crearAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function normalizarTelefono(valor: string | null | undefined) {
  const digitos = String(valor || '').replace(/\D/g, '');
  return digitos.length === 9 && digitos.startsWith('9') ? `56${digitos}` : digitos;
}

export async function GET(request: Request) {
  const admin = crearAdmin();
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!admin || !token) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });

  const { data: autenticacion } = await admin.auth.getUser(token);
  if (!autenticacion.user) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
  const { data: perfil } = await admin
    .from('perfiles_usuario')
    .select('empresa_id,activo')
    .eq('id', autenticacion.user.id)
    .maybeSingle();
  if (!perfil?.activo) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });

  const numero = normalizarTelefono(new URL(request.url).searchParams.get('telefono'));
  if (!/^569\d{8}$/.test(numero)) {
    return NextResponse.json({ error: 'El teléfono no tiene un formato móvil chileno válido.' }, { status: 400 });
  }

  const { data: eventos, error } = await admin
    .from('whatsapp_eventos')
    .select('estado,tipo,observacion,payload,created_at')
    .eq('empresa_id', perfil.empresa_id)
    .in('telefono', [`+${numero}`, numero])
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const evidencia = (eventos || []).find((evento: any) => {
    const estado = String(evento.estado || '').toLowerCase();
    const entrante = evento.payload?.direccion !== 'saliente';
    return entrante || estado === 'delivered' || estado === 'read';
  }) as any;

  if (evidencia) {
    const fecha = new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Santiago',
    }).format(new Date(evidencia.created_at));
    return NextResponse.json({
      confirmado: true,
      detalle: `hubo comunicación comprobada el ${fecha}.`,
    });
  }

  return NextResponse.json({
    confirmado: false,
    detalle: eventos?.length
      ? 'hay intentos registrados, pero todavía ninguno fue entregado ni recibido.'
      : 'aún no existe una comunicación entregada o recibida con este número.',
  });
}
