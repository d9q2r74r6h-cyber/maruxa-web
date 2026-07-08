import { NextResponse } from 'next/server';
import { obtenerProductosCatalogo } from '@/lib/catalogo-publico';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  const categoria = url.searchParams.get('categoria');
  const excluirId = Number(url.searchParams.get('excluir') || 0) || null;
  const limite = Number(url.searchParams.get('limite') || 0) || null;

  const { data, error } = await obtenerProductosCatalogo({
    slug,
    categoria,
    excluirId,
    limite,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json(
    slug ? { producto: data[0] || null } : { productos: data },
    {
      headers: {
        'cache-control': 'no-store, no-cache, max-age=0, must-revalidate',
        pragma: 'no-cache',
      },
    }
  );
}
