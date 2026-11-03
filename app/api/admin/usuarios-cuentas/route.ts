import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
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
  if (
    !solicitante?.activo ||
    !['superadmin', 'administrador'].includes(solicitante.rol)
  ) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  const { data: perfiles } = await admin
    .from('perfiles_usuario')
    .select('id')
    .eq('empresa_id', solicitante.empresa_id);
  const ids = new Set((perfiles || []).map((perfil) => perfil.id));

  const cuentas: { id: string; email: string | null }[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      return NextResponse.json({ error: 'No se pudieron consultar las cuentas.' }, { status: 502 });
    }
    const usuarios = data.users || [];
    cuentas.push(
      ...usuarios
        .filter((usuario) => ids.has(usuario.id))
        .map((usuario) => ({ id: usuario.id, email: usuario.email || null }))
    );
    if (usuarios.length < 1000) break;
  }

  return NextResponse.json({ cuentas });
}
