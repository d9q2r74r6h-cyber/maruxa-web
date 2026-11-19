export type ItemStockControlado = {
  id: string | number;
  nombre: string;
  codigo?: string | null;
  tipo?: string | null;
  unidadBase?: string | null;
  stockActual?: number | string | null;
  stockMinimo?: number | string | null;
  controlaStock?: boolean | null;
  costoUnitario?: number | null;
  origen: 'productos' | 'ingredientes';
};

export type EstadoStock = 'agotado' | 'bajo_minimo' | 'normal';

type ItemStockConProveedor = ItemStockControlado & {
  proveedorId?: string | null;
  proveedorNombre?: string | null;
};

export type ItemStockDiagnosticado<T extends ItemStockControlado = ItemStockControlado> = T & {
  stockActualNumero: number;
  stockMinimoNumero: number;
  estado: EstadoStock;
  faltante: number;
};

function numero(valor: unknown) {
  const resultado = Number(valor || 0);
  return Number.isFinite(resultado) ? resultado : 0;
}

export function diagnosticarStock<T extends ItemStockControlado>(item: T): ItemStockDiagnosticado<T> {
  const stockActualNumero = numero(item.stockActual);
  const stockMinimoNumero = Math.max(0, numero(item.stockMinimo));
  const agotado = stockActualNumero <= 0;
  const bajoMinimo = !agotado && stockMinimoNumero > 0 && stockActualNumero <= stockMinimoNumero;

  return {
    ...item,
    stockActualNumero,
    stockMinimoNumero,
    estado: agotado ? 'agotado' : bajoMinimo ? 'bajo_minimo' : 'normal',
    faltante: Math.max(0, stockMinimoNumero - stockActualNumero),
  };
}

export function valorizarStock<T extends ItemStockControlado>(item: ItemStockDiagnosticado<T>) {
  const costoUnitario = Math.max(0, numero(item.costoUnitario));

  return {
    valorEnStock: Math.max(0, item.stockActualNumero) * costoUnitario,
    costoReposicionMinima: item.faltante * costoUnitario,
  };
}

export type ResumenReposicionProveedor = {
  proveedorId: string | null;
  proveedorNombre: string;
  productosCriticos: number;
  costoReposicionMinima: number;
};

export function resumirReposicionPorProveedor<T extends ItemStockConProveedor>(
  items: ItemStockDiagnosticado<T>[]
): ResumenReposicionProveedor[] {
  const resumen = new Map<string, ResumenReposicionProveedor>();

  for (const item of items) {
    const proveedorId = item.proveedorId || null;
    const clave = proveedorId || '__sin_proveedor__';
    const proveedorNombre = item.proveedorNombre?.trim() || (proveedorId ? 'Proveedor sin nombre' : 'Sin proveedor');
    const actual = resumen.get(clave) || {
      proveedorId,
      proveedorNombre,
      productosCriticos: 0,
      costoReposicionMinima: 0,
    };

    actual.productosCriticos += 1;
    actual.costoReposicionMinima += valorizarStock(item).costoReposicionMinima;
    resumen.set(clave, actual);
  }

  return [...resumen.values()].sort(
    (a, b) =>
      b.costoReposicionMinima - a.costoReposicionMinima ||
      b.productosCriticos - a.productosCriticos ||
      a.proveedorNombre.localeCompare(b.proveedorNombre, 'es')
  );
}

export function obtenerStockCritico<T extends ItemStockControlado>(items: T[]): ItemStockDiagnosticado<T>[] {
  const prioridad: Record<EstadoStock, number> = {
    agotado: 0,
    bajo_minimo: 1,
    normal: 2,
  };

  return items
    .filter((item) => item.controlaStock !== false)
    .map((item) => diagnosticarStock(item))
    .filter((item) => item.estado !== 'normal')
    .sort(
      (a, b) =>
        prioridad[a.estado] - prioridad[b.estado] ||
        a.nombre.localeCompare(b.nombre, 'es')
    );
}
