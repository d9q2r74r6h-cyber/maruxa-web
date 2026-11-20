import assert from 'node:assert/strict';
import test from 'node:test';
import { sincronizarCarritoConCatalogo } from '../lib/sincronizar-carrito.ts';

test('actualiza el carrito con el precio y presentación vigente', () => {
  const resultado = sincronizarCarritoConCatalogo(
    [{ id: 1, nombre: 'Torta antigua', precio: 12000, imagen: null, cantidad: 1, tamano: '10 personas', presentacion_id: '10' }],
    [{
      id: 1,
      nombre: 'Torta de hoja',
      precio: 10000,
      imagen: 'https://ejemplo.cl/torta.jpg',
      categoria: 'Pastelería',
      familia: { nombre: 'Tortas' },
      presentaciones: [{ id: '10', nombre: '10 personas', precio: 14990, activo: true }],
    }]
  );

  assert.equal(resultado.retirados, 0);
  assert.equal(resultado.actualizados, 1);
  assert.deepEqual(resultado.items[0], {
    id: 1,
    nombre: 'Torta de hoja',
    precio: 14990,
    imagen: 'https://ejemplo.cl/torta.jpg',
    cantidad: 1,
    tamano: '10 personas',
    presentacion_id: '10',
    requiere_anticipacion: true,
  });
});

test('quita productos y presentaciones que ya no están disponibles', () => {
  const resultado = sincronizarCarritoConCatalogo(
    [
      { id: 1, nombre: 'Retirado', precio: 1000, imagen: null, cantidad: 1 },
      { id: 2, nombre: 'Sin tamaño', precio: 1000, imagen: null, cantidad: 1, presentacion_id: 'inactiva' },
    ],
    [{
      id: 2,
      nombre: 'Torta',
      precio: 1000,
      imagen: null,
      presentaciones: [{ id: 'inactiva', nombre: '10 personas', precio: 1000, activo: false }],
    }]
  );

  assert.equal(resultado.retirados, 2);
  assert.deepEqual(resultado.items, []);
});
