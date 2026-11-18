import assert from 'node:assert/strict';
import test from 'node:test';
import { resumirCajaMensual } from '../lib/resumen-caja-mensual.ts';

const cierres = [
  {
    id: 'cerrada',
    fecha: '2026-11-10',
    estado: 'cerrada' as const,
    total_ventas: 100,
    efectivo: 30,
    tarjetas: 20,
    compras_gastos: [{ monto: 10 }],
    turnos_panaderos: [
      {
        lineas: [
          {
            funcionario_id: 'panadero-1',
            nombre: 'HUMBERTO',
            total_pago: 40,
            bonos: [{ monto: 5 }],
            dominical: 5,
            septimo: 10,
          },
        ],
      },
    ],
  },
  {
    id: 'borrador',
    fecha: '2026-11-11',
    estado: 'borrador' as const,
    total_ventas: 200,
    efectivo: 100,
    tarjetas: 100,
    compras_gastos: [],
    turnos_panaderos: [],
  },
];

test('resume solo cajas cerradas por defecto y conserva los borradores aparte', () => {
  const resumen = resumirCajaMensual(cierres);

  assert.equal(resumen.cerradas.length, 1);
  assert.equal(resumen.borradores.length, 1);
  assert.equal(resumen.totalVentas, 100);
  assert.equal(resumen.cuadre, 100);
  assert.equal(resumen.diferencia, 0);
  assert.deepEqual(resumen.pagosPanaderos, [
    {
      clave: 'panadero-1',
      nombre: 'HUMBERTO',
      dias: 1,
      turnos: 1,
      baseYDemasia: 20,
      bonos: 5,
      dominicales: 5,
      septimos: 10,
      total: 40,
    },
  ]);
});

test('puede incluir borradores solo para previsualización mensual', () => {
  const resumen = resumirCajaMensual(cierres, true);

  assert.equal(resumen.consideradas.length, 2);
  assert.equal(resumen.totalVentas, 300);
  assert.equal(resumen.cuadre, 300);
});
