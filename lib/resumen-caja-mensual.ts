export type LineaCajaResumen = {
  nombre?: string | null;
  funcionario_id?: string | null;
  monto?: number | string | null;
  total_pago?: number | string | null;
  dominical?: number | string | null;
  septimo?: number | string | null;
  bonos?: Array<{ monto?: number | string | null }> | null;
};

export type TurnoCajaResumen = {
  nombre?: string | null;
  qq?: number | string | null;
  lineas?: LineaCajaResumen[] | null;
};

export type CierreCajaResumen = {
  id: string;
  fecha: string;
  estado: 'borrador' | 'cerrada';
  cajera_nombre?: string | null;
  total_ventas?: number | string | null;
  efectivo?: number | string | null;
  tarjetas?: number | string | null;
  compras_gastos?: Array<{ monto?: number | string | null }> | null;
  turnos_panaderos?: TurnoCajaResumen[] | null;
  panaderos_primer_turno?: LineaCajaResumen[] | null;
  panaderos_segundo_turno?: LineaCajaResumen[] | null;
};

export type PagoPanaderoMensual = {
  clave: string;
  nombre: string;
  dias: number;
  turnos: number;
  baseYDemasia: number;
  bonos: number;
  dominicales: number;
  septimos: number;
  total: number;
};

function numero(valor: unknown) {
  const resultado = Number(valor || 0);
  return Number.isFinite(resultado) ? resultado : 0;
}

export function lineasDeCaja(cierre: CierreCajaResumen) {
  if (Array.isArray(cierre.turnos_panaderos) && cierre.turnos_panaderos.length) {
    return cierre.turnos_panaderos.flatMap((turno) => turno.lineas || []);
  }
  return [
    ...(cierre.panaderos_primer_turno || []),
    ...(cierre.panaderos_segundo_turno || []),
  ];
}

export function totalPanaderosCaja(cierre: CierreCajaResumen) {
  return lineasDeCaja(cierre).reduce(
    (total, linea) => total + numero(linea.total_pago ?? linea.monto),
    0
  );
}

export function totalGastosCaja(cierre: CierreCajaResumen) {
  return (cierre.compras_gastos || []).reduce(
    (total, gasto) => total + numero(gasto.monto),
    0
  );
}

export function resumirCajaMensual(
  cierres: CierreCajaResumen[],
  incluirBorradores = false
) {
  const cerradas = cierres.filter((cierre) => cierre.estado === 'cerrada');
  const borradores = cierres.filter((cierre) => cierre.estado !== 'cerrada');
  const consideradas = incluirBorradores ? cierres : cerradas;
  const pagosPorPanadero = new Map<
    string,
    PagoPanaderoMensual & { fechas: Set<string> }
  >();

  for (const cierre of consideradas) {
    for (const linea of lineasDeCaja(cierre)) {
      const nombre = String(linea.nombre || '').trim();
      const total = numero(linea.total_pago ?? linea.monto);
      if (!nombre || total <= 0) continue;

      const clave = linea.funcionario_id || `nombre:${nombre.toLocaleUpperCase('es-CL')}`;
      const actual = pagosPorPanadero.get(clave) || {
        clave,
        nombre,
        dias: 0,
        turnos: 0,
        baseYDemasia: 0,
        bonos: 0,
        dominicales: 0,
        septimos: 0,
        total: 0,
        fechas: new Set<string>(),
      };
      const bonos = (linea.bonos || []).reduce(
        (suma, bono) => suma + numero(bono.monto),
        0
      );
      const dominical = numero(linea.dominical);
      const septimo = numero(linea.septimo);

      actual.turnos += 1;
      actual.fechas.add(cierre.fecha);
      actual.baseYDemasia += Math.max(0, total - bonos - dominical - septimo);
      actual.bonos += bonos;
      actual.dominicales += dominical;
      actual.septimos += septimo;
      actual.total += total;
      pagosPorPanadero.set(clave, actual);
    }
  }

  const totalVentas = consideradas.reduce(
    (total, cierre) => total + numero(cierre.total_ventas),
    0
  );
  const efectivo = consideradas.reduce(
    (total, cierre) => total + numero(cierre.efectivo),
    0
  );
  const tarjetas = consideradas.reduce(
    (total, cierre) => total + numero(cierre.tarjetas),
    0
  );
  const panaderos = consideradas.reduce(
    (total, cierre) => total + totalPanaderosCaja(cierre),
    0
  );
  const gastos = consideradas.reduce(
    (total, cierre) => total + totalGastosCaja(cierre),
    0
  );
  const cuadre = efectivo + tarjetas + panaderos + gastos;

  return {
    cerradas,
    borradores,
    consideradas,
    totalVentas,
    efectivo,
    tarjetas,
    panaderos,
    gastos,
    cuadre,
    diferencia: totalVentas - cuadre,
    pagosPanaderos: [...pagosPorPanadero.values()]
      .map(({ fechas, ...pago }) => ({ ...pago, dias: fechas.size }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  };
}
