import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function crearAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request: Request) {
  const admin = crearAdmin();
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!admin || !token) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });

  const { data: autenticacion } = await admin.auth.getUser(token);
  if (!autenticacion.user) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
  const { data: perfil } = await admin.from('perfiles_usuario').select('empresa_id,activo').eq('id', autenticacion.user.id).maybeSingle();
  if (!perfil?.activo) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });

  const { data: eventos, error } = await admin
    .from('whatsapp_eventos')
    .select('id,telefono,observacion,created_at,payload')
    .eq('empresa_id', perfil.empresa_id)
    .eq('tipo', 'plantilla_cliente')
    .in('estado', ['error', 'failed'])
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = [...new Set((eventos || []).map((item: any) => item.payload?.cliente_id).filter(Boolean))];
  const { data: clientes } = ids.length
    ? await admin.from('clientes').select('id,razon_social').eq('empresa_id', perfil.empresa_id).in('id', ids)
    : { data: [] };
  const nombres = new Map((clientes || []).map((cliente: any) => [String(cliente.id), cliente.razon_social]));

  return NextResponse.json({
    errores: (eventos || []).map((evento: any) => ({
      id: evento.id,
      cliente: nombres.get(String(evento.payload?.cliente_id || '')) || 'Cliente no identificado',
      telefono: evento.telefono || '-',
      error: evento.observacion || 'Error sin detalle',
      fecha: evento.created_at,
    })),
  });
}
