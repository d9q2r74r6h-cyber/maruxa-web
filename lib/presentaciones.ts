export type Presentacion = { id: string; nombre: string; precio: number; activo: boolean };
export type ProductoConPresentaciones = {
  presentaciones?: Presentacion[] | null;
  precio_10?: number | null; precio_15?: number | null;
  precio_20?: number | null; precio_25?: number | null;
};
export function presentacionesProducto(producto: ProductoConPresentaciones): Presentacion[] {
  if (Array.isArray(producto.presentaciones)) return producto.presentaciones;
  return ([10, 15, 20, 25] as const).flatMap((personas) => {
    const precio = Number(producto[`precio_${personas}`] || 0);
    return precio > 0 ? [{ id: `legacy-${personas}`, nombre: `${personas} personas`, precio, activo: true }] : [];
  });
}
export function presentacionesDisponibles(producto: ProductoConPresentaciones) {
  return presentacionesProducto(producto).filter((p) => p.activo && Number.isFinite(p.precio) && p.precio > 0);
}
export function validarPresentaciones(presentaciones: Presentacion[]) {
  const nombres = new Set<string>();
  const ids = new Set<string>();
  for (const p of presentaciones) {
    const nombre = p.nombre.trim().toLocaleLowerCase('es');
    if (!p.id || ids.has(p.id)) throw new Error('Cada presentación debe tener un identificador único.');
    if (!nombre || p.nombre.trim().length > 80) throw new Error('Cada presentación necesita un nombre de hasta 80 caracteres.');
    if (nombres.has(nombre)) throw new Error('No repitas el nombre de una presentación.');
    if (!Number.isSafeInteger(p.precio) || p.precio <= 0) throw new Error('Ingresa un precio positivo en pesos, sin decimales, para cada presentación.');
    ids.add(p.id); nombres.add(nombre);
  }
}
