import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type ProductoFeed = {
  id: number;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  categoria: string | null;
  imagen: string | null;
  slug: string | null;
};

const baseUrl = 'https://panaderiamaruxa.cl';

function crearAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !url) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function limpiar(valor: string | number | null | undefined) {
  return String(valor ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function csv(valor: string | number | null | undefined) {
  const texto = limpiar(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

function precio(valor: number | null | undefined) {
  return `${Math.round(Number(valor || 0))} CLP`;
}

function enlaceProducto(producto: ProductoFeed) {
  if (producto.slug) return `${baseUrl}/producto/${producto.slug}`;
  return `${baseUrl}/catalogo`;
}

export async function GET() {
  const admin = crearAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: 'Cliente Supabase no configurado.' },
      { status: 500 }
    );
  }

  const { data, error } = await admin
    .from('productos')
    .select('id,codigo,nombre,descripcion,precio,categoria,imagen,slug')
    .eq('tipo_producto', 'producto')
    .eq('activo', true)
    .gt('precio', 0)
    .order('nombre', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const columnas = [
    'id',
    'title',
    'description',
    'availability',
    'condition',
    'price',
    'link',
    'image_link',
    'brand',
    'google_product_category',
  ];

  const filas = ((data || []) as ProductoFeed[]).map((producto) => [
    csv(producto.codigo || `producto-${producto.id}`),
    csv(producto.nombre),
    csv(producto.descripcion || producto.nombre),
    csv('in stock'),
    csv('new'),
    csv(precio(producto.precio)),
    csv(enlaceProducto(producto)),
    csv(producto.imagen || `${baseUrl}/logo-maruxa.png`),
    csv('Panaderia Maruxa'),
    csv(producto.categoria || 'Bakery'),
  ]);

  const contenido = [
    columnas.join(','),
    ...filas.map((fila) => fila.join(',')),
  ].join('\n');

  return new Response(contenido, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'cache-control': 'public, max-age=900',
    },
  });
}
