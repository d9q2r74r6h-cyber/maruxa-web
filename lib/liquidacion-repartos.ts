export function calcularLiquidacion({ entregado, porcentaje, diasLibres, anticipo, abono, abonoAnterior = 0 }: {
  entregado: number; porcentaje: number; diasLibres: number; anticipo: number; abono: number; abonoAnterior?: number;
}) {
  const baseComision = Math.round(entregado) + Math.round(abonoAnterior);
  const montoComision = Math.round(baseComision * porcentaje / 100);
  const valorDiaComision = montoComision / 30;
  const montoLiquidacion = Math.round(montoComision + valorDiaComision * diasLibres);
  // El abono anterior integra la base de comisión; no se suma otra vez al retiro.
  const subtotalLiquidacion = Math.round(anticipo) - montoLiquidacion;
  const totalLiquidacion = (subtotalLiquidacion + Math.round(abono)) || 0;
  return { baseComision, montoComision, valorDiaComision, montoLiquidacion, subtotalLiquidacion, totalLiquidacion };
}
