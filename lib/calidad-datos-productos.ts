export type ProductoParaCalidad = {
  id: number | string;
  tipo_producto?: string | null;
  unidad_base?: string | null;
  undxcaja?: number | null;
  contenido_por_unidad?: number | null;
  unidad_contenido?: string | null;
};

export type CodigoProveedorParaCalidad = {
  proveedor_id: string;
  producto_id: number | string;
  codigo_proveedor: string;
};

export type DiagnosticoDatosProductos = {
  sinUnidadBase: number;
  tipoNoConfigurado: number;
  cajaSinContenido: number;
  codigosProveedorAmbiguos: number;
};

export function normalizarCodigoProveedor(codigo: string | null | undefined) {
  return String(codigo || '')
    .toLocaleUpperCase('es-CL')
    .replace(/[^A-Z0-9]/g, '');
}

export function diagnosticarDatosProductos(
  productos: ProductoParaCalidad[],
  codigosProveedor: CodigoProveedorParaCalidad[],
  tiposConfigurados: string[]
): DiagnosticoDatosProductos {
  const tiposValidos = new Set(tiposConfigurados.filter(Boolean));
  const codigosPorProveedor = new Map<string, Set<string>>();

  for (const codigo of codigosProveedor) {
    const normalizado = normalizarCodigoProveedor(codigo.codigo_proveedor);
    if (!codigo.proveedor_id || !normalizado) continue;
    const clave = `${codigo.proveedor_id}::${normalizado}`;
    const productosAsociados = codigosPorProveedor.get(clave) || new Set<string>();
    productosAsociados.add(String(codigo.producto_id));
    codigosPorProveedor.set(clave, productosAsociados);
  }

  return {
    sinUnidadBase: productos.filter(
      (producto) => !String(producto.unidad_base || '').trim()
    ).length,
    tipoNoConfigurado: productos.filter(
      (producto) =>
        tiposValidos.size > 0 &&
        !tiposValidos.has(String(producto.tipo_producto || ''))
    ).length,
    cajaSinContenido: productos.filter((producto) => {
      const unidadesPorCaja = Number(producto.undxcaja || 0);
      if (unidadesPorCaja <= 0) return false;
      return (
        Number(producto.contenido_por_unidad || 0) <= 0 ||
        !String(producto.unidad_contenido || '').trim()
      );
    }).length,
    codigosProveedorAmbiguos: [...codigosPorProveedor.values()].filter(
      (productosAsociados) => productosAsociados.size > 1
    ).length,
  };
}
