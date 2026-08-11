import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function texto(valor: unknown) { return String(valor ?? '').trim().replace(/\s+/g, ' '); }
function pareceTextoHumano(valor: unknown, minimo: number, maximo: number) {
  const dato = texto(valor);
  if (dato.length < minimo || dato.length > maximo || !/[a-záéíóúñ]/iu.test(dato) || /\S{28,}/.test(dato) || /(.)\1{5,}/iu.test(dato)) return false;
  return !dato.split(/\s+/).filter(Boolean).some((palabra) => {
    const letras = palabra.replace(/[^a-záéíóúñ]/giu, '');
    if (letras.length < 10) return false;
    const cambios = [...letras].slice(1).reduce((total, letra, indice) => total + (/[A-ZÁÉÍÓÚÑ]/.test(letra) !== /[A-ZÁÉÍÓÚÑ]/.test(letras[indice]) ? 1 : 0), 0);
    const vocales = (letras.match(/[aeiouáéíóú]/giu) || []).length / letras.length;
    return cambios >= 4 || vocales < 0.12 || vocales > 0.75;
  });
}
function pareceNombreCompleto(valor: unknown) {
  const dato = texto(valor);
  return pareceTextoHumano(dato, 5, 100) && dato.split(/\s+/).filter((parte) => /[a-záéíóúñ]{2,}/iu.test(parte)).length >= 2;
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
  const { data: perfil } = await admin.from('perfiles_usuario').select('empresa_id,activo,rol').eq('id', autenticacion.user.id).maybeSingle();
  if (!perfil?.activo || !['superadmin', 'administrador'].includes(perfil.rol)) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });

  const { data: pendientes, error } = await admin.from('clientes_mayoristas').select('id,auth_user_id,razon_social,contacto_nombre,empresa_direccion,empresa_comuna,empresa_ciudad').eq('empresa_id', perfil.empresa_id).eq('estado', 'pendiente');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const sucias = (pendientes || []).filter((item) =>
    !pareceTextoHumano(item.razon_social, 3, 120) ||
    !pareceNombreCompleto(item.contacto_nombre) ||
    !pareceTextoHumano(item.empresa_direccion, 5, 160) ||
    !pareceTextoHumano(item.empresa_comuna, 2, 80) ||
    !pareceTextoHumano(item.empresa_ciudad, 2, 80)
  );
  if (!sucias.length) return NextResponse.json({ ok: true, eliminadas: 0 });

  const ids = sucias.map((item) => item.id);
  const { error: errorBorrado } = await admin.from('clientes_mayoristas').delete().in('id', ids).eq('empresa_id', perfil.empresa_id).eq('estado', 'pendiente');
  if (errorBorrado) return NextResponse.json({ error: errorBorrado.message }, { status: 500 });
  const cuentas = sucias.map((item) => item.auth_user_id).filter(Boolean) as string[];
  const resultados = await Promise.allSettled(cuentas.map((id) => admin.auth.admin.deleteUser(id)));
  const cuentasConError = resultados.filter((resultado) => resultado.status === 'rejected').length;
  return NextResponse.json({ ok: true, eliminadas: sucias.length, cuentas_eliminadas: cuentas.length - cuentasConError, cuentas_con_error: cuentasConError });
}
