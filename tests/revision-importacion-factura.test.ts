import assert from 'node:assert/strict';
import test from 'node:test';
import { resumirRevisionImportacion } from '../lib/revision-importacion-factura.ts';

test('resume asociaciones, pendientes y creación de una factura', () => {
  const resumen = resumirRevisionImportacion([
    {
      nombre: 'Leche', cantidad: 2, montoNeto: 2_400,
      producto: { id: 1, nombre: 'LECHE 1 LT', costo_unitario: 1_000 },
      asociadaPorCodigo: true,
    },
    { nombre: 'Producto nuevo', cantidad: 1, montoNeto: 500, tipoNuevo: 'producto' },
    { nombre: 'Sin revisar', cantidad: 1, montoNeto: 500 },
  ]);

  assert.equal(resumen.totalLineas, 3);
  assert.equal(resumen.asociadas, 1);
  assert.equal(resumen.asociadasPorCodigo, 1);
  assert.equal(resumen.porCrear, 1);
  assert.equal(resumen.pendientes, 1);
  assert.equal(resumen.unidadesInventario, 4);
});

test('compara el costo por unidad de inventario al comprar cajas', () => {
  const resumen = resumirRevisionImportacion([{
    nombre: 'Yogurt', cantidad: 4, montoNeto: 7_200,
    producto: { id: 1, nombre: 'YOGURT 155G', costo_unitario: 40 },
    compraPorCaja: true,
    unidadesPorCaja: 36,
  }]);

  assert.equal(resumen.unidadesInventario, 144);
  assert.equal(resumen.lineasPorCaja, 1);
  assert.equal(resumen.variaciones[0].costoFactura, 50);
  assert.equal(resumen.variaciones[0].variacionPorcentaje, 25);
  assert.equal(resumen.variacionesAnormales.length, 1);
});
