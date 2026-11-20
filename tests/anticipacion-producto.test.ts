import assert from 'node:assert/strict';
import test from 'node:test';
import { requiereAnticipacionProducto } from '../lib/anticipacion-producto.ts';

test('identifica tortas por categoría, nombre o familia del catálogo', () => {
  assert.equal(
    requiereAnticipacionProducto({ categoria: 'Tortas' }),
    true
  );
  assert.equal(
    requiereAnticipacionProducto({ nombre: 'Torta de hoja manjar' }),
    true
  );
  assert.equal(
    requiereAnticipacionProducto({
      categoria: 'Pastelería',
      familia: { nombre: 'Tortas', familia_principal: { nombre: 'Pastelería' } },
    }),
    true
  );
  assert.equal(
    requiereAnticipacionProducto({ categoria: 'Panadería', nombre: 'Hallulla' }),
    false
  );
});
