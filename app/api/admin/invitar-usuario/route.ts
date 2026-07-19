import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          'Configura SUPABASE_SERVICE_ROLE_KEY en el servidor para invitar usuarios.',
      },
      { status: 503 }
    );
  }

  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.replace(/^Bearer\s+/i, '');

  if (!accessToken) {
    return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: autenticacion, error: errorAutenticacion } =
    await admin.auth.getUser(accessToken);

  if (errorAutenticacion || !autenticacion.user) {
    return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
  }

  const { data: solicitante } = await admin
    .from('perfiles_usuario')
    .select('empresa_id, rol, activo')
    .eq('id', autenticacion.user.id)
    .maybeSingle();

  if (
    !solicitante?.activo ||
    !['superadmin', 'administrador'].includes(solicitante.rol)
  ) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  const { email, nombre, funcionarioId, rol } = await request.json();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nombre_visible: nombre },
    redirectTo: `${new URL(request.url).origin}/admin/crear-contrasena`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { error: errorPerfil } = await admin.from('perfiles_usuario').insert({
    id: data.user.id,
    empresa_id: solicitante.empresa_id,
    funcionario_id: funcionarioId || null,
    nombre_visible: nombre,
    rol: rol || 'operador',
    activo: true,
  });

  if (errorPerfil) {
    await admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: errorPerfil.message }, { status: 400 });
  }

  return NextResponse.json({ userId: data.user.id });
}
