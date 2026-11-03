import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!url || !serviceRoleKey || !token) {
    return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: autenticacion } = await admin.auth.getUser(token);
  if (!autenticacion.user) {
    return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
  }

  const { data: solicitante } = await admin
    .from('perfiles_usuario')
    .select('empresa_id,rol,activo')
    .eq('id', autenticacion.user.id)
    .maybeSingle();
  if (!solicitante?.activo || !['superadmin', 'administrador'].includes(solicitante.rol)) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  const cuerpo = await request.json();
  const usuarioId = String(cuerpo?.usuarioId || '');
  const email = String(cuerpo?.email || '').trim().toLowerCase();
  if (!usuarioId || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Correo de acceso inválido.' }, { status: 400 });
  }

  const { data: destino } = await admin
    .from('perfiles_usuario')
    .select('id')
    .eq('id', usuarioId)
    .eq('empresa_id', solicitante.empresa_id)
    .maybeSingle();
  if (!destino) {
    return NextResponse.json({ error: 'La cuenta no pertenece a esta empresa.' }, { status: 404 });
  }

  const { data, error } = await admin.auth.admin.updateUserById(usuarioId, { email });
  if (error || !data.user?.email) {
    return NextResponse.json({ error: error?.message || 'No se pudo actualizar el correo de acceso.' }, { status: 400 });
  }

  return NextResponse.json({ email: data.user.email });
}
