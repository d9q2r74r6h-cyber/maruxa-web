import { createClient } from '@supabase/supabase-js';

export type ProductoCatalogo = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  categoria: string;
  imagen: string | null;
  destacado?: boolean | null;
  slug: string | null;
  tipo_producto?: string | null;
  precio_10?: number | null;
  precio_15?: number | null;
  precio_20?: number | null;
  precio_25?: number | null;
};

type FiltrosCatalogo = {
  slug?: string | null;
  categoria?: string | null;
  excluirId?: number | null;
  limite?: number | null;
};

function crearAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !url) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function obtenerProductosCatalogo(filtros: FiltrosCatalogo = {}) {
  const admin = crearAdmin();

  if (!admin) {
    return { data: [] as ProductoCatalogo[], error: 'Catalogo no configurado.' };
  }

  let consulta = admin
    .from('productos')
    .select(`
      id,
      nombre,
      descripcion,
      precio,
      categoria,
      imagen,
      destacado,
      slug,
      tipo_producto,
      precio_10,
      precio_15,
      precio_20,
      precio_25,
      familias_productos!inner (
        id
      )
    `)
    .eq('activo', true)
    .eq('tipo_producto', 'producto')
    .eq('familias_productos.activo', true)
    .eq('familias_productos.mostrar_catalogo', true)
    .not('slug', 'is', null)
    .gt('precio', 0)
    .order('destacado', { ascending: false })
    .order('id', { ascending: true });

  if (filtros.slug) {
    consulta = consulta.eq('slug', filtros.slug);
  }

  if (filtros.categoria) {
    consulta = consulta.ilike('categoria', `%${filtros.categoria}%`);
  }

  if (filtros.excluirId) {
    consulta = consulta.neq('id', filtros.excluirId);
  }

  if (filtros.limite) {
    consulta = consulta.limit(filtros.limite);
  }

  const { data, error } = await consulta;

  return {
    data: ((data || []) as unknown as ProductoCatalogo[]).map((producto) => ({
      id: producto.id,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio: producto.precio,
      categoria: producto.categoria,
      imagen: producto.imagen,
      destacado: producto.destacado,
      slug: producto.slug,
      tipo_producto: producto.tipo_producto,
      precio_10: producto.precio_10,
      precio_15: producto.precio_15,
      precio_20: producto.precio_20,
      precio_25: producto.precio_25,
    })),
    error: error?.message || null,
  };
}
