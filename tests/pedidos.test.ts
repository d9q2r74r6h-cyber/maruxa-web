import assert from 'node:assert/strict';
import test from 'node:test';
import {
  totalPedido,
  validarItemPedido,
  validarRetiro,
  type ProductoPedidoFuente,
} from '../lib/pedidos.ts';

const producto: ProductoPedidoFuente = {
  id: 10,
  nombre: 'Torta panqueque naranja',
  precio: 19990,
  precio_10: 25000,
  precio_15: 33000,
  precio_20: 41000,
  precio_25: 49000,
  imagen: null,
};

test('usa el precio vigente del tamaño y no el enviado por el navegador', () => {
  const item = validarItemPedido(
    { id: 10, cantidad: 2, tamano: '15 personas' },
    producto
  );
  assert.equal(item.precio, 33000);
  assert.equal(totalPedido([item]), 66000);
});

test('usa el precio general cuando el producto no lleva tamaños configurados', () => {
  const item = validarItemPedido(
    { id: 10, cantidad: 1 },
    {
      ...producto,
      precio_10: null,
      precio_15: null,
      precio_20: null,
      precio_25: null,
    }
  );
  assert.equal(item.precio, 19990);
});

test('exige tamaño cuando el producto tiene precios por tamaño', () => {
  assert.throws(
    () => validarItemPedido({ id: 10, cantidad: 1 }, producto),
    /Selecciona un tamaño/
  );
});

test('rechaza tamaños inventados', () => {
  assert.throws(
    () => validarItemPedido({ id: 10, cantidad: 1, tamano: '100 personas' }, producto),
    /Tamaño inválido/
  );
});

test('rechaza cantidades fraccionarias, negativas o excesivas', () => {
  for (const cantidad of [-1, 0, 1.5, 101]) {
    assert.throws(
      () => validarItemPedido({ id: 10, cantidad }, producto),
      /Cantidad inválida/
    );
  }
});

test('rechaza productos sin precio vigente', () => {
  assert.throws(
    () => validarItemPedido({ id: 10, cantidad: 1 }, {
          ...producto,
          precio: 0,
          precio_10: null,
          precio_15: null,
          precio_20: null,
          precio_25: null,
        }),
    /no tiene un precio vigente/
  );
});
test('rechaza fechas inexistentes y horas fuera de rango', () => {
  assert.throws(
    () => validarRetiro('2026-02-30', '10:00', '2026-01-01', false),
    /inválida/
  );
  assert.throws(
    () => validarRetiro('2026-03-10', '25:00', '2026-01-01', false),
    /inválida/
  );
});

test('exige 24 horas completas para las tortas', () => {
  const ahora = new Date('2026-08-31T10:00:00-04:00');
  assert.throws(
    () => validarRetiro('2026-08-31', '18:00', '2026-08-31', true, ahora),
    /24 horas/
  );
  assert.throws(
    () => validarRetiro('2026-09-01', '09:00', '2026-08-31', true, ahora),
    /24 horas/
  );
  assert.doesNotThrow(() =>
    validarRetiro('2026-09-01', '10:00', '2026-08-31', true, ahora)
  );
});

test('no permite una hora de retiro que ya pasó hoy para productos sin anticipación', () => {
  const ahora = new Date('2026-08-31T10:00:00-04:00');
  assert.throws(
    () => validarRetiro('2026-08-31', '09:59', '2026-08-31', false, ahora),
    /hora de retiro ya pasó/
  );
  assert.doesNotThrow(() =>
    validarRetiro('2026-08-31', '10:01', '2026-08-31', false, ahora)
  );
});
