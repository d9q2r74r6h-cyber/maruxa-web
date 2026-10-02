const SUFIJO_CANTIDAD_CAJA =
  /\s*\(\s*(\d+(?:[.,]\d+)?)\s*(?:(?:u|un|und|unds|unid(?:ad(?:es)?)?)\s*)?(?:por\s+caja)?\s*\)\s*$/i;

export type DatosCajaProducto = {
  nombre: string;
  undxcaja: number | null;
};

export function separarUnidadesCaja(
  nombre: string,
  unidadesIndicadas?: number | string | null
): DatosCajaProducto {
  const coincidencia = nombre.match(SUFIJO_CANTIDAD_CAJA);
  const unidadesIngresadas = Number(unidadesIndicadas);
  const unidadesNombre = coincidencia ? Number(coincidencia[1]) : 0;
  const nombreLimpio = coincidencia
    ? nombre.replace(SUFIJO_CANTIDAD_CAJA, '').trim()
    : nombre.trim();

  return {
    nombre: nombreLimpio || nombre.trim(),
    undxcaja:
      Number.isInteger(unidadesIngresadas) && unidadesIngresadas > 0
        ? unidadesIngresadas
        : Number.isInteger(unidadesNombre) && unidadesNombre > 0
          ? unidadesNombre
          : null,
  };
}

export function nombreProductoPublico(nombre: string) {
  return separarUnidadesCaja(nombre).nombre;
}
