type FamiliaProducto = {
  nombre?: string | null;
  familia_principal?: {
    nombre?: string | null;
  } | null;
};

export type ProductoConAnticipacion = {
  nombre?: string | null;
  categoria?: string | null;
  familia?: FamiliaProducto | null;
};

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function requiereAnticipacionProducto(producto: ProductoConAnticipacion) {
  return normalizar(
    [
      producto.nombre,
      producto.categoria,
      producto.familia?.nombre,
      producto.familia?.familia_principal?.nombre,
    ]
      .filter((valor): valor is string => Boolean(valor))
      .join(' ')
  ).includes('torta');
}
