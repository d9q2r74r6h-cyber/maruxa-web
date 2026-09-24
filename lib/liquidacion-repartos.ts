export function calcularLiquidacion({ entregado, porcentaje, diasLibres, anticipo, abono, abonoAnterior = 0 }: {
  entregado: number; porcentaje: number; diasLibres: number; anticipo: number; abono: number; abonoAnterior?: number;
}) {
  const montoComision = Math.round(entregado * porcentaje / 100);
  const valorDiaComision = montoComision / 30;
  const montoLiquidacion = Math.round(montoComision + valorDiaComision * diasLibres);
  // El abono anterior está disponible para retirar; el nuevo queda para el siguiente mes.
  const subtotalLiquidacion = Math.round(anticipo) - montoLiquidacion - Math.round(abonoAnterior);
  const totalLiquidacion = (subtotalLiquidacion + Math.round(abono)) || 0;
  return { montoComision, valorDiaComision, montoLiquidacion, subtotalLiquidacion, totalLiquidacion };
}
