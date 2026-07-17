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
  familia?: {
    id: string;
    nombre: string;
    familia_padre_id: string | null;
    familia_principal: {
      id: string;
      nombre: string;
    } | null;
  } | null;
};

type FiltrosCatalogo = {
  slug?: string | null;
  categoria?: string | null;
  excluirId?: number | null;
  limite?: number | null;
};

type ProductoCatalogoConsulta = Omit<ProductoCatalogo, 'familia'> & {
  familias_productos: {
    id: string;
    nombre: string;
    familia_padre_id: string | null;
  } | null;
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
        id,
        nombre,
        familia_padre_id
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

  if (error) {
    return { data: [] as ProductoCatalogo[], error: error.message };
  }

  const productosConsulta = (data || []) as unknown as ProductoCatalogoConsulta[];

  const idsFamiliasPrincipales = [
    ...new Set(
      productosConsulta
        .map((producto) => producto.familias_productos?.familia_padre_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const { data: familiasPrincipales, error: errorFamilias } =
    idsFamiliasPrincipales.length > 0
      ? await admin
          .from('familias_productos')
          .select('id,nombre')
          .in('id', idsFamiliasPrincipales)
      : { data: [], error: null };

  if (errorFamilias) {
    return { data: [] as ProductoCatalogo[], error: errorFamilias.message };
  }

  const familiasPrincipalesPorId = new Map(
    (familiasPrincipales || []).map((familia) => [familia.id, familia])
  );

  return {
    data: productosConsulta.map((producto) => ({
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
      familia: producto.familias_productos
        ? {
            id: producto.familias_productos.id,
            nombre: producto.familias_productos.nombre,
            familia_padre_id:
              producto.familias_productos.familia_padre_id || null,
            familia_principal:
              familiasPrincipalesPorId.get(
                producto.familias_productos.familia_padre_id || ''
              ) || null,
          }
        : null,
    })),
    error: null,
  };
}
