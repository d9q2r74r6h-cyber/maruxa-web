import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function crearAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !url) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function idsValidos(valor: unknown) {
  if (!Array.isArray(valor)) return [];
  return valor.filter(
    (id): id is string => typeof id === 'string' && id.length > 0
  );
}

export async function POST(request: Request) {
  const admin = crearAdmin();
  const token = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '');

  if (!admin || !token) {
    return NextResponse.json({ error: 'Sesion no disponible.' }, { status: 401 });
  }

  const { data: autenticacion } = await admin.auth.getUser(token);
  if (!autenticacion.user) {
    return NextResponse.json({ error: 'Sesion invalida.' }, { status: 401 });
  }

  const { data: perfil } = await admin
    .from('perfiles_usuario')
    .select('empresa_id,activo')
    .eq('id', autenticacion.user.id)
    .maybeSingle();

  if (!perfil?.activo || !perfil.empresa_id) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  const cuerpo = await request.json().catch(() => ({}));
  const whatsappIds = idsValidos(cuerpo.whatsappIds);
  const instagramIds = idsValidos(cuerpo.instagramIds);
  const errores: string[] = [];

  if (whatsappIds.length > 0) {
    const { error } = await admin
      .from('whatsapp_eventos')
      .update({ estado: 'leido' })
      .eq('empresa_id', perfil.empresa_id)
      .in('id', whatsappIds)
      .not('estado', 'in', '(respondido,informativo)');
    if (error) errores.push(error.message);
  }

  if (instagramIds.length > 0) {
    const { error } = await admin
      .from('instagram_eventos')
      .update({ estado: 'leido' })
      .eq('empresa_id', perfil.empresa_id)
      .in('id', instagramIds)
      .not('estado', 'in', '(respondido,informativo)');
    if (error) errores.push(error.message);
  }

  if (errores.length > 0) {
    return NextResponse.json({ error: errores.join(' | ') }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    actualizados: whatsappIds.length + instagramIds.length,
  });
}
