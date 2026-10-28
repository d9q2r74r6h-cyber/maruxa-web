import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function crearAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function fechaChile(fecha: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(fecha));
}

function horaChile(fecha: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(fecha));
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

  const desde = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const { data: eventos, error } = await admin
    .from('whatsapp_eventos')
    .select('id,telefono,estado,observacion,created_at,payload')
    .eq('empresa_id', perfil.empresa_id)
    .eq('tipo', 'recordatorio_cliente')
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(3000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clienteIds = [...new Set((eventos || []).map((evento: any) => evento.payload?.cliente_id).filter(Boolean))];
  const { data: clientes } = clienteIds.length
    ? await admin
        .from('clientes')
        .select('id,razon_social')
        .eq('empresa_id', perfil.empresa_id)
        .in('id', clienteIds)
    : { data: [] };
  const nombres = new Map((clientes || []).map((cliente: any) => [String(cliente.id), cliente.razon_social]));

  const envios = (eventos || []).map((evento: any) => {
    const estado = String(evento.estado || 'desconocido').toLowerCase();
    return {
      id: evento.id,
      fecha: evento.payload?.fecha_local || fechaChile(evento.created_at),
      hora: horaChile(evento.created_at),
      cliente: nombres.get(String(evento.payload?.cliente_id || '')) || 'Cliente no identificado',
      telefono: evento.telefono || '-',
      estado,
      detalle: evento.observacion || 'Sin detalle adicional.',
    };
  });

  const porFecha = new Map<string, any>();
  for (const envio of envios) {
    if (!porFecha.has(envio.fecha)) {
      porFecha.set(envio.fecha, {
        fecha: envio.fecha,
        total: 0,
        enviados: 0,
        entregados: 0,
        leidos: 0,
        pendientes: 0,
        errores: 0,
      });
    }
    const dia = porFecha.get(envio.fecha);
    dia.total += 1;
    if (['aceptado', 'sent', 'delivered', 'read'].includes(envio.estado)) dia.enviados += 1;
    if (['delivered', 'read'].includes(envio.estado)) dia.entregados += 1;
    if (envio.estado === 'read') dia.leidos += 1;
    if (['aceptado', 'sent'].includes(envio.estado)) dia.pendientes += 1;
    if (['error', 'failed'].includes(envio.estado)) dia.errores += 1;
  }

  return NextResponse.json({
    resumen: [...porFecha.values()].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    envios,
  });
}
