import { requiereAnticipacionProducto } from './anticipacion-producto.ts';
import { presentacionesDisponibles, type Presentacion } from './presentaciones.ts';

export type ItemCarritoSincronizable = {
  id: number;
  nombre: string;
  precio: number;
  imagen: string | null;
  tamano?: string;
  presentacion_id?: string;
  requiere_anticipacion?: boolean;
  cantidad: number;
};

export type ProductoCatalogoCarrito = {
  id: number;
  nombre: string;
  precio: number;
  imagen: string | null;
  categoria?: string | null;
  familia?: {
    nombre?: string | null;
    familia_principal?: { nombre?: string | null } | null;
  } | null;
  presentaciones?: Presentacion[] | null;
  precio_10?: number | null;
  precio_15?: number | null;
  precio_20?: number | null;
  precio_25?: number | null;
};

export type ResultadoSincronizacionCarrito = {
  items: ItemCarritoSincronizable[];
  retirados: number;
  actualizados: number;
};

export function sincronizarCarritoConCatalogo(
  items: ItemCarritoSincronizable[],
  productos: ProductoCatalogoCarrito[]
): ResultadoSincronizacionCarrito {
  const productosPorId = new Map(productos.map((producto) => [producto.id, producto]));
  let retirados = 0;
  let actualizados = 0;
  const itemsActualizados: ItemCarritoSincronizable[] = [];

  for (const item of items) {
    const producto = productosPorId.get(item.id);
    if (!producto) {
      retirados += 1;
      continue;
    }

    const presentaciones = presentacionesDisponibles(producto);
    const requierePresentacion = presentaciones.length > 0;
    const tieneSeleccionGuardada = Boolean(item.presentacion_id || item.tamano);
    const presentacion = item.presentacion_id
      ? presentaciones.find((opcion) => opcion.id === item.presentacion_id)
      : presentaciones.find((opcion) => opcion.nombre === item.tamano);

    if ((requierePresentacion || tieneSeleccionGuardada) && !presentacion) {
      retirados += 1;
      continue;
    }

    const siguiente: ItemCarritoSincronizable = {
      ...item,
      nombre: producto.nombre,
      precio: presentacion?.precio ?? producto.precio,
      imagen: producto.imagen,
      requiere_anticipacion: requiereAnticipacionProducto(producto),
      ...(presentacion
        ? { tamano: presentacion.nombre, presentacion_id: presentacion.id }
        : {}),
    };
    if (
      siguiente.nombre !== item.nombre ||
      siguiente.precio !== item.precio ||
      siguiente.imagen !== item.imagen ||
      siguiente.tamano !== item.tamano ||
      siguiente.presentacion_id !== item.presentacion_id ||
      siguiente.requiere_anticipacion !== item.requiere_anticipacion
    ) {
      actualizados += 1;
    }
    itemsActualizados.push(siguiente);
  }

  return { items: itemsActualizados, retirados, actualizados };
}
