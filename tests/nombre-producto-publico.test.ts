import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nombreProductoPublico,
  separarUnidadesCaja,
} from '../lib/nombre-producto-publico.ts';

test('oculta la cantidad de la caja en el catalogo publico', () => {
  assert.equal(nombreProductoPublico('BERLIDOTS BOMBON (36 U)'), 'BERLIDOTS BOMBON');
  assert.equal(nombreProductoPublico('CROISSANT BOMBON MIDI (90)'), 'CROISSANT BOMBON MIDI');
  assert.equal(nombreProductoPublico('MINI DOTS NEGRITO (60 UNIDADES)'), 'MINI DOTS NEGRITO');
});

test('conserva parentesis que describen una variedad y cantidades fuera del sufijo', () => {
  assert.equal(nombreProductoPublico('BRAZO DE REINA (MEDIANO)'), 'BRAZO DE REINA (MEDIANO)');
  assert.equal(nombreProductoPublico('BEBIDA 1.5 L'), 'BEBIDA 1.5 L');
});

test('separa las unidades por caja para guardarlas en undxcaja', () => {
  assert.deepEqual(separarUnidadesCaja('BERLIDOTS BOMBON (36 U)'), {
    nombre: 'BERLIDOTS BOMBON',
    undxcaja: 36,
  });
  assert.deepEqual(separarUnidadesCaja('CROISSANT BOMBON MIDI (90)'), {
    nombre: 'CROISSANT BOMBON MIDI',
    undxcaja: 90,
  });
});

test('respeta undxcaja ingresada por separado y limpia el nombre', () => {
  assert.deepEqual(separarUnidadesCaja('MINI DOTS (60 U)', '48'), {
    nombre: 'MINI DOTS',
    undxcaja: 48,
  });
});
