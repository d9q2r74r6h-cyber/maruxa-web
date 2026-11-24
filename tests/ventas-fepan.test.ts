import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerVentasFepan } from '../lib/ventas-fepan.ts';

test('agrupa las categorías acordadas y excluye pan de pascua', () => {
  const filas: unknown[][] = [['Categoria', 'Código', 'Descripción', 'Cantidad', 'Total', 'Forma Pago']];
  for (const [codigo, total] of Object.entries({ Z01: 100, Z02: 20, Z03: 30, Z07: 40, Z08: 50, Z06: 900, Z04: 60, Z05: 70 })) filas.push(['categoría', codigo, codigo, 1, total, null]);
  const datos = leerVentasFepan(filas);
  assert.equal(datos.filter(d => d.grupo === 'Pan').reduce((s, d) => s + d.total, 0), 240);
  assert.equal(datos.find(d => d.codigo === 'Z06'), undefined);
  assert.equal(datos.find(d => d.codigo === 'Z04')?.grupo, 'Cecinas');
  assert.equal(datos.find(d => d.codigo === 'Z05')?.grupo, 'Pastelería');
});

test('rechaza archivos o montos no reconocibles', () => {
  assert.throws(() => leerVentasFepan([['otro archivo']]));
  assert.throws(() => leerVentasFepan([['Categoria', 'Código', 'Descripción', 'Cantidad', 'Total'], ['PAN', 'Z01', 'PAN', 1, 'incorrecto']]));
});
