export const TAMANOS_TORTA = {
  '10 personas': 'precio_10',
  '15 personas': 'precio_15',
  '20 personas': 'precio_20',
  '25 personas': 'precio_25',
} as const;

export type TamanoTorta = keyof typeof TAMANOS_TORTA;

export type ProductoPedidoFuente = {
  id: number;
  nombre: string;
  precio: number | null;
  precio_10: number | null;
  precio_15: number | null;
  precio_20: number | null;
  precio_25: number | null;
  imagen: string | null;
};

export type ItemPedidoEntrada = {
  id: number;
  cantidad: number;
  tamano?: string | null;
};

export type ItemPedidoValidado = {
  id: number;
  nombre: string;
  cantidad: number;
  precio: number;
  imagen: string | null;
  tamano?: TamanoTorta;
};

function enteroSeguro(valor: unknown) {
  const numero = Number(valor);
  return Number.isSafeInteger(numero) ? numero : 0;
}

export function validarItemPedido(
  entrada: ItemPedidoEntrada,
  producto: ProductoPedidoFuente
): ItemPedidoValidado {
  const cantidad = enteroSeguro(entrada.cantidad);
  if (cantidad < 1 || cantidad > 100) {
    throw new Error(`Cantidad inválida para ${producto.nombre}.`);
  }

  const tamanoTexto = String(entrada.tamano || '').trim();
  const requiereTamano = [
    producto.precio_10,
    producto.precio_15,
    producto.precio_20,
    producto.precio_25,
  ].some((precioTamano) => Number(precioTamano || 0) > 0);
  let precio = Number(producto.precio || 0);
  let tamano: TamanoTorta | undefined;

  if (requiereTamano && !tamanoTexto) {
    throw new Error(`Selecciona un tamaño para ${producto.nombre}.`);
  }

  if (tamanoTexto) {
    if (!(tamanoTexto in TAMANOS_TORTA)) {
      throw new Error(`Tamaño inválido para ${producto.nombre}.`);
    }

    tamano = tamanoTexto as TamanoTorta;
    const campo = TAMANOS_TORTA[tamano];
    precio = Number(producto[campo] || 0);
  }

  if (!Number.isFinite(precio) || precio <= 0) {
    throw new Error(`El producto ${producto.nombre} no tiene un precio vigente.`);
  }

  return {
    id: producto.id,
    nombre: producto.nombre,
    cantidad,
    precio: Math.round(precio),
    imagen: producto.imagen || null,
    ...(tamano ? { tamano } : {}),
  };
}

export function totalPedido(items: ItemPedidoValidado[]) {
  return items.reduce(
    (total, item) => total + item.precio * item.cantidad,
    0
  );
}
export function validarRetiro(
  fecha: string,
  hora: string,
  hoyChile: string,
  requiereAnticipacion: boolean
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
    throw new Error('Fecha u hora de retiro inválida.');
  }

  const fechaDate = new Date(`${fecha}T12:00:00Z`);
  if (Number.isNaN(fechaDate.getTime())) {
    throw new Error('Fecha u hora de retiro inválida.');
  }
  const fechaNormalizada = fechaDate.toISOString().slice(0, 10);
  const [horas, minutos] = hora.split(':').map(Number);
  if (
    fechaNormalizada !== fecha ||
    horas < 0 ||
    horas > 23 ||
    minutos < 0 ||
    minutos > 59
  ) {
    throw new Error('Fecha u hora de retiro inválida.');
  }

  if (fecha < hoyChile) throw new Error('La fecha de retiro ya pasó.');
  if (requiereAnticipacion && fecha <= hoyChile) {
    throw new Error('Las tortas requieren retiro desde el día siguiente.');
  }
}