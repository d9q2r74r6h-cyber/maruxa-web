import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function crearAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET() {
  const admin = crearAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: 'Datos de transferencia no configurados.' },
      { status: 503 }
    );
  }

  const { data: empresa, error: errorEmpresa } = await admin
    .from('empresas')
    .select('id')
    .eq('slug', 'maruxa')
    .eq('activo', true)
    .maybeSingle();

  if (errorEmpresa || !empresa) {
    return NextResponse.json(
      { error: 'Empresa no disponible.' },
      { status: 503 }
    );
  }

  const { data: cuenta, error: errorCuenta } = await admin
    .from('cuentas_bancarias')
    .select('banco,tipo_cuenta,numero_cuenta,titular,rut_titular,email_notificacion')
    .eq('empresa_id', empresa.id)
    .eq('activo', true)
    .eq('es_principal', true)
    .limit(1)
    .maybeSingle();

  if (errorCuenta) {
    return NextResponse.json(
      { error: 'No se pudieron consultar los datos de transferencia.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { cuenta: cuenta || null },
    { headers: { 'cache-control': 'no-store, no-cache, max-age=0, must-revalidate' } }
  );
}
