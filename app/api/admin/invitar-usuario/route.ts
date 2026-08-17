import { NextResponse } from 'next/server';
import { createClient, type User } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function escaparHtml(valor: string) {
  return String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

  if (!resend) {
    return NextResponse.json(
      { error: 'El correo de Panadería Maruxa no está configurado.' },
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

  let { data, error } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: { nombre_visible: nombre } },
  });
  let usuarioNuevo = true;

  if (error) {
    const { data: usuariosExistentes, error: errorUsuarios } =
      await admin.auth.admin.listUsers({ perPage: 1000 });
    const usuarios = (usuariosExistentes?.users || []) as User[];
    const usuarioExistente = usuarios.find(
      (usuario) => usuario.email?.toLowerCase() === String(email).toLowerCase()
    );

    if (errorUsuarios || !usuarioExistente) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { data: perfilExistente } = await admin
      .from('perfiles_usuario')
      .select('empresa_id')
      .eq('id', usuarioExistente.id)
      .maybeSingle();

    if (perfilExistente?.empresa_id !== solicitante.empresa_id) {
      return NextResponse.json(
        { error: 'El correo ya pertenece a otra cuenta.' },
        { status: 409 }
      );
    }

    const recuperacion = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });
    data = recuperacion.data;
    error = recuperacion.error;
    usuarioNuevo = false;
  }

  if (error || !data.user || !data.properties?.hashed_token) {
    return NextResponse.json(
      { error: error?.message || 'No se pudo generar la invitación.' },
      { status: 400 }
    );
  }

  const { error: errorPerfil } = usuarioNuevo
    ? await admin.from('perfiles_usuario').insert({
        id: data.user.id,
        empresa_id: solicitante.empresa_id,
        funcionario_id: funcionarioId || null,
        nombre_visible: nombre,
        rol: rol || 'operador',
        activo: true,
      })
    : { error: null };

  if (errorPerfil) {
    await admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: errorPerfil.message }, { status: 400 });
  }

  const urlInvitacion = new URL('/admin/crear-contrasena', request.url);
  urlInvitacion.searchParams.set('token_hash', data.properties.hashed_token);
  urlInvitacion.searchParams.set(
    'type',
    data.properties.verification_type === 'recovery' ? 'recovery' : 'invite'
  );

  const { error: errorCorreo } = await resend.emails.send({
    from: 'Panadería Maruxa <admin@panaderiamaruxa.cl>',
    to: [email],
    subject: 'Crea tu contraseña de Panadería Maruxa',
    html: `
      <div style="background:#fff3df;padding:32px 16px;font-family:Arial,sans-serif;color:#2a1710">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #ead8c5;border-radius:16px;padding:32px">
          <p style="margin:0;color:#a51f2b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">Maruxa ERP</p>
          <h1 style="margin:8px 0 16px;font-size:28px">Bienvenido/a, ${escaparHtml(nombre)}</h1>
          <p style="margin:0 0 24px;line-height:1.6">Se creó una cuenta para ti en Panadería Maruxa. Presiona el botón para crear tu contraseña y comenzar a usar el sistema.</p>
          <a href="${escaparHtml(urlInvitacion.toString())}" style="display:inline-block;background:#a51f2b;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:8px">Crear mi contraseña</a>
          <p style="margin:24px 0 0;color:#76584a;font-size:12px;line-height:1.5">Si no esperabas esta invitación, puedes ignorar este correo.</p>
        </div>
      </div>
    `,
  });

  if (errorCorreo) {
    if (usuarioNuevo) {
      await admin.from('perfiles_usuario').delete().eq('id', data.user.id);
      await admin.auth.admin.deleteUser(data.user.id);
    }
    return NextResponse.json(
      { error: `No se pudo enviar la invitación: ${errorCorreo.message}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ userId: data.user.id });
}
