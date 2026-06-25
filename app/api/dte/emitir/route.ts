import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { obtenerEstadoConfiguracionDte } from '@/lib/dte/configuracion';

export async function POST(request: Request) {
  const configuracion = obtenerEstadoConfiguracionDte();

  if (!configuracion.listoParaFirmar) {
    return NextResponse.json(
      {
        error:
          'La emisión DTE no está configurada. Falta certificado, clave, RUT emisor o resolución.',
        configuracion,
      },
      { status: 503 }
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '');

  if (!serviceRoleKey || !accessToken) {
    return NextResponse.json(
      { error: 'La sesión o la configuración de servidor no es válida.' },
      { status: 401 }
    );
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: autenticacion } = await admin.auth.getUser(accessToken);

  if (!autenticacion.user) {
    return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
  }

  const { documentoId } = await request.json();
  const { data: documento } = await admin
    .from('documentos_tributarios')
    .select('id, estado, tipo_dte, folio')
    .eq('id', documentoId)
    .maybeSingle();

  if (!documento) {
    return NextResponse.json(
      { error: 'Documento no encontrado.' },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      error:
        'El almacenamiento y la configuración están listos, pero falta incorporar la librería de firma XML y el envío certificado al SII.',
    },
    { status: 501 }
  );
}
