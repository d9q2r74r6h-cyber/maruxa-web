import assert from 'node:assert/strict';
import test from 'node:test';
import {
  diagnosticarDatosProductos,
  normalizarCodigoProveedor,
  obtenerProductosConCodigosProveedorAmbiguos,
} from '../lib/calidad-datos-productos.ts';

test('normaliza los códigos de proveedor para detectar asociaciones ambiguas', () => {
  assert.equal(normalizarCodigoProveedor('abc- 123'), 'ABC123');
  assert.equal(normalizarCodigoProveedor('ABC123'), 'ABC123');
});

test('identifica productos incompletos sin modificarlos', () => {
  const diagnostico = diagnosticarDatosProductos(
    [
      { id: 1, tipo_producto: 'producto', unidad_base: null },
      {
        id: 2,
        tipo_producto: 'producto',
        unidad_base: 'UN',
        undxcaja: 12,
        contenido_por_unidad: null,
        unidad_contenido: null,
      },
      { id: 3, tipo_producto: 'desconocido', unidad_base: 'KG' },
    ],
    [
      { proveedor_id: 'p1', producto_id: 1, codigo_proveedor: 'ABC-123' },
      { proveedor_id: 'p1', producto_id: 2, codigo_proveedor: 'abc 123' },
    ],
    ['producto', 'ingrediente', 'envase']
  );

  assert.deepEqual(diagnostico, {
    sinUnidadBase: 1,
    tipoNoConfigurado: 1,
    cajaSinContenido: 1,
    codigosProveedorAmbiguos: 1,
  });
});

test('devuelve todos los productos involucrados en un código de proveedor ambiguo', () => {
  const productos = obtenerProductosConCodigosProveedorAmbiguos([
    { proveedor_id: 'p1', producto_id: 12, codigo_proveedor: '000-120' },
    { proveedor_id: 'p1', producto_id: 14, codigo_proveedor: '000120' },
    { proveedor_id: 'p2', producto_id: 15, codigo_proveedor: '000120' },
  ]);

  assert.deepEqual([...productos].sort(), ['12', '14']);
});
