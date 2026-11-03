import { NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase-public';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { data } = await supabasePublic
    .from('empresas')
    .select('logo_url')
    .eq('slug', 'maruxa')
    .eq('activo', true)
    .limit(1)
    .maybeSingle();

  const destino = data?.logo_url || new URL('/favicon.ico.png', request.url).toString();
  return NextResponse.redirect(destino, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
