import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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
  activo?: boolean | null;
  tipo_producto?: string | null;
  familia_id?: string | number | null;
  familias_productos?: {
    nombre?: string | null;
    mostrar_catalogo?: boolean | null;
    activo?: boolean | null;
  } | null;
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

type ProductoDiagnostico = {
  id: number;
  codigo: string | null;
  nombre: string;
  precio: number | null;
  categoria: string | null;
  activo: boolean | null;
  tipo_producto: string | null;
  familia_id: string | number | null;
  familias_productos?:
    | {
        nombre?: string | null;
        mostrar_catalogo?: boolean | null;
        activo?: boolean | null;
      }
    | {
        nombre?: string | null;
        mostrar_catalogo?: boolean | null;
        activo?: boolean | null;
      }[]
    | null;
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

function textoCatalogo(valor: string | null | undefined) {
  const texto = limpiar(valor);
  if (!texto) return '';

  return texto
    .toLocaleLowerCase('es-CL')
    .replace(/(^|[.!?]\s+)([a-záéíóúüñ])/g, (match) =>
      match.toLocaleUpperCase('es-CL')
    );
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
  const nombre = textoCatalogo(producto.nombre);
  const descripcion = textoCatalogo(producto.descripcion || producto.nombre);
  const imagen = producto.imagen || `${baseUrl}/logo-maruxa.png`;
  const categoria = producto.categoria || 'Bakery';
  const enlace = enlaceProducto(producto);

  if (!esTorta(producto)) {
    return [
      {
        id: idBase(producto),
        titulo: nombre,
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
    titulo: `${nombre} ${tamano.personas} personas`,
    descripcion: `${descripcion} - ${tamano.personas} personas`,
    precio: tamano.precio,
    enlace,
    imagen,
    categoria,
  }));
}

export async function GET(request: Request) {
  const admin = crearAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: 'Cliente Supabase no configurado.' },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const diagnostico = url.searchParams.get('debug')?.trim();

  if (diagnostico) {
    const { data, error } = await admin
      .from('productos')
      .select(`
        id,
        codigo,
        nombre,
        precio,
        categoria,
        activo,
        tipo_producto,
        familia_id,
        familias_productos (
          nombre,
          mostrar_catalogo,
          activo
        )
      `)
      .ilike('nombre', `%${diagnostico}%`)
      .order('nombre', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      busqueda: diagnostico,
      productos: ((data || []) as ProductoDiagnostico[]).map((producto) => {
        const familia = Array.isArray(producto.familias_productos)
          ? producto.familias_productos[0]
          : producto.familias_productos;
        const incluido =
          producto.tipo_producto === 'producto' &&
          producto.activo === true &&
          Number(producto.precio || 0) > 0 &&
          familia?.activo === true &&
          familia?.mostrar_catalogo === true;

        return {
          id: producto.id,
          codigo: producto.codigo,
          nombre: producto.nombre,
          categoria: producto.categoria,
          precio: producto.precio,
          activo: producto.activo,
          tipo_producto: producto.tipo_producto,
          familia: familia?.nombre || null,
          familia_activa: familia?.activo ?? null,
          familia_mostrar_catalogo: familia?.mostrar_catalogo ?? null,
          incluido_en_feed_meta: incluido,
        };
      }),
    }, {
      headers: {
        'cache-control': 'no-store, no-cache, max-age=0, must-revalidate',
        pragma: 'no-cache',
      },
    });
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
        nombre,
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
      'cache-control': 'no-store, no-cache, max-age=0, must-revalidate',
      pragma: 'no-cache',
      expires: '0',
    },
  });
}
