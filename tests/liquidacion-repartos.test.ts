import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularLiquidacion } from '../lib/liquidacion-repartos.ts';
const base = { entregado: 14088000, porcentaje: 4, diasLibres: 6, anticipo: 450000, abono: 100000 };
test('el abono reduce el pendiente del ejemplo de Luis', () => {
 const r=calcularLiquidacion(base);
 assert.equal(r.montoComision,563520);
 assert.equal(r.montoLiquidacion,676224);
 assert.equal(r.subtotalLiquidacion,-226224);
 assert.equal(r.totalLiquidacion,-126224);
});
test('incorpora el saldo a la comisión del siguiente mes una sola vez', () => {
 const anterior=calcularLiquidacion(base).totalLiquidacion;
 const siguiente=calcularLiquidacion({entregado:1000000,porcentaje:4,diasLibres:0,anticipo:10000,abono:5000,saldoAnterior:anterior});
 assert.equal(siguiente.montoComision,40000);
 assert.equal(siguiente.subtotalLiquidacion,-156224);
 assert.equal(siguiente.totalLiquidacion,-151224);
});
test('permite saldar completamente o dejar saldo positivo',()=>{
 assert.equal(calcularLiquidacion({...base,abono:226224}).totalLiquidacion,0);
 assert.equal(calcularLiquidacion({...base,abono:300000}).totalLiquidacion,73776);
});
