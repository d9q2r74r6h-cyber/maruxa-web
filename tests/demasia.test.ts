import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calcularDemasiaPlanilla,
  compararDemasia,
  demasiaCajaAPlanilla,
} from '../lib/demasia.ts';

test('calcula la demasía de Planilla desde amasado y panaderos', () => {
  assert.equal(calcularDemasiaPlanilla(5.25, 2), 1.25);
  assert.equal(calcularDemasiaPlanilla(11.25, 4), 3.25);
});

test('convierte Caja a la escala de Planilla con el ajuste fijo', () => {
  assert.equal(demasiaCajaAPlanilla(1.5), 1.25);
  assert.equal(demasiaCajaAPlanilla(3.5), 3.25);
  assert.equal(demasiaCajaAPlanilla(0), 0);
});

test('no alerta cuando Caja y Planilla cuadran', () => {
  assert.deepEqual(compararDemasia(11.25, 4, 3.5), {
    esperadaPlanilla: 3.25,
    cajaEnPlanilla: 3.25,
    diferencia: 0,
  });
});

test('permite aplicar una vigencia posterior sin alterar la regla base', () => {
  assert.deepEqual(compararDemasia(11.25, 4, 3.75, { ajusteCajaAPlanilla: 0.5 }), {
    esperadaPlanilla: 3.25,
    cajaEnPlanilla: 3.25,
    diferencia: 0,
  });
});

test('mantiene el ajuste base cuando una vigencia viene incompleta', () => {
  assert.equal(demasiaCajaAPlanilla(1.5, {}), 1.25);
});
