import assert from 'node:assert/strict';
import test from 'node:test';
import { claveTelefono, telefonosCoinciden } from '../lib/telefonos.ts';

test('normaliza las variantes habituales de un teléfono chileno', () => {
  assert.equal(claveTelefono('+56 9 1234 5678'), '912345678');
  assert.equal(claveTelefono('56912345678'), '912345678');
  assert.equal(claveTelefono('9 1234 5678'), '912345678');
  assert.equal(claveTelefono('12345678'), '912345678');
});

test('relaciona el teléfono de WhatsApp con la ficha de cliente', () => {
  assert.equal(telefonosCoinciden('9 1234 5678', '+56 9 1234 5678'), true);
  assert.equal(telefonosCoinciden('+56 9 1234 5678', '+56 9 8765 4321'), false);
  assert.equal(telefonosCoinciden(null, '+56 9 1234 5678'), false);
});
