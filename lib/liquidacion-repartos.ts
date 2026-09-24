export function calcularLiquidacion({ entregado, porcentaje, diasLibres, anticipo, abono, saldoAnterior = 0 }: {
  entregado: number; porcentaje: number; diasLibres: number; anticipo: number; abono: number; saldoAnterior?: number;
}) {
  const montoComision = entregado * porcentaje / 100;
  const valorDiaComision = montoComision / 30;
  const montoLiquidacion = montoComision + valorDiaComision * diasLibres;
  const subtotalLiquidacion = saldoAnterior + anticipo - montoLiquidacion;
  return { montoComision, valorDiaComision, montoLiquidacion, subtotalLiquidacion, totalLiquidacion: subtotalLiquidacion + abono };
}
