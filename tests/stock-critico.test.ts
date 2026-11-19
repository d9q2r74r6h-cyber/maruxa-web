import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnosticarStock, obtenerStockCritico, resumirReposicionPorProveedor, valorizarStock } from '../lib/stock-critico.ts';

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

test('valoriza el stock disponible y la reposición según el mínimo', () => {
  const conStock = valorizarStock(diagnosticarStock({
    id: 1,
    nombre: 'Harina',
    stockActual: 8,
    stockMinimo: 10,
    costoUnitario: 450,
    controlaStock: true,
    origen: 'productos',
  }));
  const agotado = valorizarStock(diagnosticarStock({
    id: 2,
    nombre: 'Mantequilla',
    stockActual: -1,
    stockMinimo: 6,
    costoUnitario: 500,
    controlaStock: true,
    origen: 'productos',
  }));

  assert.deepEqual(conStock, { valorEnStock: 3600, costoReposicionMinima: 900 });
  assert.deepEqual(agotado, { valorEnStock: 0, costoReposicionMinima: 3500 });
});

test('resume la reposición crítica por proveedor', () => {
  const resumen = resumirReposicionPorProveedor([
    diagnosticarStock({ id: 1, nombre: 'Harina', stockActual: 3, stockMinimo: 10, costoUnitario: 100, controlaStock: true, origen: 'productos', proveedorId: 'p1', proveedorNombre: 'Molinos' }),
    diagnosticarStock({ id: 2, nombre: 'Levadura', stockActual: 0, stockMinimo: 2, costoUnitario: 300, controlaStock: true, origen: 'productos', proveedorId: 'p1', proveedorNombre: 'Molinos' }),
    diagnosticarStock({ id: 3, nombre: 'Caja', stockActual: 1, stockMinimo: 3, costoUnitario: 200, controlaStock: true, origen: 'productos' }),
  ]);

  assert.deepEqual(resumen, [
    { proveedorId: 'p1', proveedorNombre: 'Molinos', productosCriticos: 2, costoReposicionMinima: 1300 },
    { proveedorId: null, proveedorNombre: 'Sin proveedor', productosCriticos: 1, costoReposicionMinima: 400 },
  ]);
});
