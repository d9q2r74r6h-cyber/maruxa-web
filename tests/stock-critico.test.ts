import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnosticarStock, obtenerStockCritico } from '../lib/stock-critico.ts';

test('identifica agotados y bajos mínimos sin incluir ítems sin control de stock', () => {
  const criticos = obtenerStockCritico([
    { id: 1, nombre: 'Harina', stockActual: 0, stockMinimo: 0, controlaStock: true, origen: 'productos' },
    { id: 2, nombre: 'Leche', stockActual: 5, stockMinimo: 5, controlaStock: true, origen: 'productos' },
    { id: 3, nombre: 'Servicio', stockActual: 0, stockMinimo: 10, controlaStock: false, origen: 'productos' },
    { id: 4, nombre: 'Normal', stockActual: 6, stockMinimo: 5, controlaStock: true, origen: 'ingredientes' },
  ]);

  assert.deepEqual(criticos.map((item) => [item.nombre, item.estado]), [
    ['Harina', 'agotado'],
    ['Leche', 'bajo_minimo'],
  ]);
});

test('calcula el faltante solo cuando existe un mínimo configurado', () => {
  const diagnosticado = diagnosticarStock({
    id: 1,
    nombre: 'Mantequilla',
    stockActual: 3,
    stockMinimo: 10,
    controlaStock: true,
    origen: 'productos',
  });

  assert.equal(diagnosticado.estado, 'bajo_minimo');
  assert.equal(diagnosticado.faltante, 7);
});
