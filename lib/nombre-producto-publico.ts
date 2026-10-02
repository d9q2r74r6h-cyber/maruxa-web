const SUFIJO_CANTIDAD_CAJA =
  /\s*\(\s*\d+(?:[.,]\d+)?\s*(?:(?:u|un|und|unds|unid(?:ad(?:es)?)?)\s*)?(?:por\s+caja)?\s*\)\s*$/i;

export function nombreProductoPublico(nombre: string) {
  const nombreLimpio = nombre.replace(SUFIJO_CANTIDAD_CAJA, '').trim();
  return nombreLimpio || nombre.trim();
}
