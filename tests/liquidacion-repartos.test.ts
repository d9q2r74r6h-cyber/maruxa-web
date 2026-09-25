import assert from 'node:assert/strict';
import test from 'node:test';
import {
 calcularLiquidacion,
 descontarAbonoLiquidacionDelSaldo,
} from '../lib/liquidacion-repartos.ts';
const base = { entregado: 14088000, porcentaje: 4, diasLibres: 6, anticipo: 450000, abono: 100000 };
test('el abono reduce lo que retira Luis en el mes', () => {
 const r=calcularLiquidacion(base);
 assert.equal(r.montoLiquidacion,676224);
 assert.equal(r.subtotalLiquidacion,-226224);
 assert.equal(r.totalLiquidacion,-126224);
});
test('febrero sin retiro arrastra su abono a marzo y no su total cero', () => {
 const febrero=calcularLiquidacion({...base,abono:226224});
 assert.equal(febrero.totalLiquidacion,0);
 const marzo=calcularLiquidacion({...base,entregado:16918420,anticipo:0,abono:0,abonoAnterior:226224});
 assert.equal(marzo.baseComision,17144644);
 assert.equal(marzo.montoComision,685786);
 assert.equal(marzo.montoLiquidacion,822943);
 assert.equal(marzo.subtotalLiquidacion,-822943);
 assert.equal(marzo.totalLiquidacion,-822943);
});
test('el retiro anterior no se vuelve a sumar y el abono nuevo pasa solo una vez', () => {
 const marzo=calcularLiquidacion({...base,entregado:16918420,anticipo:0,abono:100000,abonoAnterior:226224});
 assert.equal(marzo.totalLiquidacion,-722943);
 const abril=calcularLiquidacion({entregado:0,porcentaje:4,diasLibres:0,anticipo:0,abono:0,abonoAnterior:100000});
 assert.equal(abril.baseComision,100000);
 assert.equal(abril.montoComision,4000);
 assert.equal(abril.totalLiquidacion,-4000);
});
test('sin abono no se arrastra nada aunque hubiera dinero por retirar', () => {
 const r=calcularLiquidacion({entregado:0,porcentaje:4,diasLibres:0,anticipo:0,abono:0,abonoAnterior:0});
 assert.equal(r.totalLiquidacion,0);
 assert.equal(Object.is(r.totalLiquidacion,-0),false);
});
test('no quedan centavos ocultos después de saldar el monto visible', () => {
 const r=calcularLiquidacion({...base,entregado:14088005,abono:226224});
 assert.equal(r.totalLiquidacion,0);
});

test("el abono anterior aplica el porcentaje del repartidor sin duplicarse en el retiro", () => {
 const r = calcularLiquidacion({entregado:1000000,porcentaje:3,diasLibres:0,anticipo:10000,abono:5000,abonoAnterior:200000});
 assert.equal(r.baseComision,1200000);
 assert.equal(r.montoComision,36000);
 assert.equal(r.subtotalLiquidacion,-26000);
 assert.equal(r.totalLiquidacion,-21000);
});

test('el abono de la liquidación rebaja el saldo que pasa al mes siguiente', () => {
 assert.equal(descontarAbonoLiquidacionDelSaldo(1500000,822943),677057);
});
