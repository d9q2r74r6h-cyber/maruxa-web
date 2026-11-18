/**
 * Reglas únicas para comparar la demasía entre Caja y Planilla.
 *
 * Caja registra 0,25 QQ adicionales respecto de la misma demasía en Planilla.
 * Esta equivalencia se usa sólo para cruces y alertas; no modifica los valores
 * históricos que cada módulo guarda.
 */
export const AJUSTE_QQ_CAJA_A_PLANILLA = 0.25;

function numeroSeguro(valor: unknown) {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

function redondearQq(valor: number) {
  return Number(valor.toFixed(2));
}

export function calcularDemasiaPlanilla(amasado: unknown, panaderos: unknown) {
  return redondearQq(numeroSeguro(amasado) - numeroSeguro(panaderos) * 2);
}

export function demasiaCajaAPlanilla(demasiaCaja: unknown) {
  return redondearQq(
    Math.max(0, numeroSeguro(demasiaCaja) - AJUSTE_QQ_CAJA_A_PLANILLA)
  );
}

export function compararDemasia(
  amasado: unknown,
  panaderos: unknown,
  demasiaCaja: unknown
) {
  const esperadaPlanilla = calcularDemasiaPlanilla(amasado, panaderos);
  const cajaEnPlanilla = demasiaCajaAPlanilla(demasiaCaja);

  return {
    esperadaPlanilla,
    cajaEnPlanilla,
    diferencia: redondearQq(cajaEnPlanilla - esperadaPlanilla),
  };
}
