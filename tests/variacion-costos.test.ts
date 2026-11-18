import assert from 'node:assert/strict';
import test from 'node:test';
import {
  porcentajeVariacionCosto,
  UMBRAL_ALERTA_VARIACION_COSTO,
  variacionCostoEsAnormal,
} from '../lib/variacion-costos.ts';

test('calcula la variación porcentual de un costo', () => {
  assert.equal(porcentajeVariacionCosto(100, 125), 25);
  assert.equal(porcentajeVariacionCosto(100, 80), -20);
});

test('alerta variaciones de costo desde el umbral configurado', () => {
  assert.equal(variacionCostoEsAnormal(100, 120), true);
  assert.equal(variacionCostoEsAnormal(100, 119.99), false);
  assert.equal(variacionCostoEsAnormal(100, 80), true);
  assert.equal(variacionCostoEsAnormal(0, 500), false);
  assert.equal(UMBRAL_ALERTA_VARIACION_COSTO, 20);
});
