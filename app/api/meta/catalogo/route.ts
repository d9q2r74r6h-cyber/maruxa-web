import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type ProductoFeed = {
  id: number;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  precio_10: number | null;
  precio_15: number | null;
  precio_20: number | null;
  precio_25: number | null;
  categoria: string | null;
  imagen: string | null;
  slug: string | null;
};

type ItemFeed = {
  id: string;
  titulo: string;
  descripcion: string;
  precio: number;
  enlace: string;
  imagen: string;
  categoria: string;
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

function esTorta(producto: ProductoFeed) {
  return limpiar(producto.categoria).toLowerCase().includes('torta');
}

function idBase(producto: ProductoFeed) {
  return producto.codigo || `producto-${producto.id}`;
}

const tamanosTorta = [
  { personas: 10, campo: 'precio_10' },
  { personas: 15, campo: 'precio_15' },
  { personas: 20, campo: 'precio_20' },
  { personas: 25, campo: 'precio_25' },
] as const;

function crearItemsFeed(producto: ProductoFeed): ItemFeed[] {
  const descripcion = limpiar(producto.descripcion || producto.nombre);
  const imagen = producto.imagen || `${baseUrl}/logo-maruxa.png`;
  const categoria = producto.categoria || 'Bakery';
  const enlace = enlaceProducto(producto);

  if (!esTorta(producto)) {
    return [
      {
        id: idBase(producto),
        titulo: producto.nombre,
        descripcion,
        precio: Number(producto.precio || 0),
        enlace,
        imagen,
        categoria,
      },
    ];
  }

  const variantes = tamanosTorta
    .map((tamano) => ({
      personas: tamano.personas,
      precio: Number(producto[tamano.campo] || 0),
    }))
    .filter((tamano) => tamano.precio > 0);

  if (variantes.length === 0 && Number(producto.precio || 0) > 0) {
    variantes.push({
      personas: 10,
      precio: Number(producto.precio || 0),
    });
  }

  return variantes.map((tamano) => ({
    id: `${idBase(producto)}-${tamano.personas}p`,
    titulo: `${producto.nombre} ${tamano.personas} personas`,
    descripcion: `${descripcion} - ${tamano.personas} personas`,
    precio: tamano.precio,
    enlace,
    imagen,
    categoria,
  }));
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
    .select(`
      id,
      codigo,
      nombre,
      descripcion,
      precio,
      precio_10,
      precio_15,
      precio_20,
      precio_25,
      categoria,
      imagen,
      slug,
      familias_productos!inner (
        mostrar_catalogo,
        activo
      )
    `)
    .eq('tipo_producto', 'producto')
    .eq('activo', true)
    .eq('familias_productos.activo', true)
    .eq('familias_productos.mostrar_catalogo', true)
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

  const items = ((data || []) as ProductoFeed[]).flatMap(crearItemsFeed);

  const filas = items.map((item) => [
    csv(item.id),
    csv(item.titulo),
    csv(item.descripcion),
    csv('in stock'),
    csv('new'),
    csv(precio(item.precio)),
    csv(item.enlace),
    csv(item.imagen),
    csv('Panaderia Maruxa'),
    csv(item.categoria),
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
