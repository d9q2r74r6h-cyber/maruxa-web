import { NextResponse } from 'next/server';
import { obtenerEstadoConfiguracionDte } from '@/lib/dte/configuracion';

export async function GET() {
  return NextResponse.json(obtenerEstadoConfiguracionDte());
}

