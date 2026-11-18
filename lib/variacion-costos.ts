export const UMBRAL_ALERTA_VARIACION_COSTO = 20;

/**
 * Un costo inicial no se marca como anormal: no existe una base válida contra
 * la cual compararlo. La regla sirve para advertir, no para impedir compras.
 */
export function variacionCostoEsAnormal(
  costoAnterior: number,
  costoNuevo: number,
  umbral = UMBRAL_ALERTA_VARIACION_COSTO
) {
  if (!Number.isFinite(costoAnterior) || !Number.isFinite(costoNuevo)) {
    return false;
  }
  if (costoAnterior <= 0 || costoNuevo <= 0) return false;

  const variacion = ((costoNuevo - costoAnterior) / costoAnterior) * 100;
  return Math.abs(variacion) >= Math.max(0, umbral);
}

export function porcentajeVariacionCosto(
  costoAnterior: number,
  costoNuevo: number
) {
  if (!Number.isFinite(costoAnterior) || costoAnterior <= 0) return 0;
  if (!Number.isFinite(costoNuevo)) return 0;
  return ((costoNuevo - costoAnterior) / costoAnterior) * 100;
}
