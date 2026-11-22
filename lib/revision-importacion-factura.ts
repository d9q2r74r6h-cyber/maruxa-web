import {
  porcentajeVariacionCosto,
  variacionCostoEsAnormal,
} from './variacion-costos.ts';

export type LineaRevisionImportacion = {
  nombre: string;
  cantidad: number;
  montoNeto: number;
  producto?: {
    id: string | number;
    nombre: string;
    costo_unitario: number | null;
  };
  tipoNuevo?: string;
  compraPorCaja?: boolean;
  unidadesPorCaja?: number;
  asociadaPorCodigo?: boolean;
};

export type VariacionRevisionImportacion = {
  indice: number;
  producto: string;
  costoAnterior: number;
  costoFactura: number;
  variacionPorcentaje: number;
  esAnormal: boolean;
};

export type ResumenRevisionImportacion = {
  totalLineas: number;
  asociadas: number;
  asociadasPorCodigo: number;
  porCrear: number;
  pendientes: number;
  unidadesInventario: number;
  lineasPorCaja: number;
  variaciones: VariacionRevisionImportacion[];
  variacionesAnormales: VariacionRevisionImportacion[];
};

const numeroFinito = (valor: number | null | undefined) =>
  Number.isFinite(valor) ? Number(valor) : 0;

/**
 * Resume la lectura antes de crear una compra. El costo siempre queda expresado
 * por unidad de inventario: si la factura cobra una caja, se divide por sus
 * unidades. Esta función no modifica ningún dato.
 */
export function resumirRevisionImportacion(
  lineas: LineaRevisionImportacion[]
): ResumenRevisionImportacion {
  const resumen: ResumenRevisionImportacion = {
    totalLineas: lineas.length,
    asociadas: 0,
    asociadasPorCodigo: 0,
    porCrear: 0,
    pendientes: 0,
    unidadesInventario: 0,
    lineasPorCaja: 0,
    variaciones: [],
    variacionesAnormales: [],
  };

  lineas.forEach((linea, indice) => {
    const cantidad = Math.max(0, numeroFinito(linea.cantidad));
    const unidadesPorCaja = Math.floor(numeroFinito(linea.unidadesPorCaja));
    const seCompraPorCaja = Boolean(linea.compraPorCaja && unidadesPorCaja > 1);
    const factorInventario = seCompraPorCaja ? unidadesPorCaja : 1;

    resumen.unidadesInventario += cantidad * factorInventario;
    if (seCompraPorCaja) resumen.lineasPorCaja += 1;

    if (!linea.producto) {
      if (linea.tipoNuevo) resumen.porCrear += 1;
      else resumen.pendientes += 1;
      return;
    }

    resumen.asociadas += 1;
    if (linea.asociadaPorCodigo) resumen.asociadasPorCodigo += 1;

    const costoFactura =
      cantidad > 0 ? numeroFinito(linea.montoNeto) / cantidad / factorInventario : 0;
    const costoAnterior = numeroFinito(linea.producto.costo_unitario);

    if (costoAnterior <= 0 || costoFactura <= 0) return;

    const variacion = {
      indice,
      producto: linea.producto.nombre || linea.nombre,
      costoAnterior,
      costoFactura,
      variacionPorcentaje: porcentajeVariacionCosto(costoAnterior, costoFactura),
      esAnormal: variacionCostoEsAnormal(costoAnterior, costoFactura),
    };
    resumen.variaciones.push(variacion);
    if (variacion.esAnormal) resumen.variacionesAnormales.push(variacion);
  });

  return resumen;
}
