import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularLiquidacion } from '../lib/liquidacion-repartos.ts';
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
 assert.equal(marzo.montoLiquidacion,812084);
 assert.equal(marzo.subtotalLiquidacion,-1038308);
 assert.equal(marzo.totalLiquidacion,-1038308);
});
test('el retiro anterior no se vuelve a sumar y el abono nuevo pasa solo una vez', () => {
 const marzo=calcularLiquidacion({...base,entregado:16918420,anticipo:0,abono:100000,abonoAnterior:226224});
 assert.equal(marzo.totalLiquidacion,-938308);
 const abril=calcularLiquidacion({entregado:0,porcentaje:4,diasLibres:0,anticipo:0,abono:0,abonoAnterior:100000});
 assert.equal(abril.totalLiquidacion,-100000);
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
