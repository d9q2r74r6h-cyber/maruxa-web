import { XMLParser, XMLValidator } from 'fast-xml-parser';

export type LineaFactura = { nombre: string; codigo: string; unidad: string; cantidad: number; montoNeto: number; exento: boolean; productoId: string };
export type FacturaLectura = {
  origen: 'xml' | 'foto'; tipo: string; folio: string; fecha: string;
  rutEmisor: string; proveedor: string; rutReceptor: string;
  neto: number; exento: number; iva: number; otros: number; total: number;
  lineas: LineaFactura[]; avisos: string[]; original: string;
};
export const normalizarRut = (valor: string) => valor.replace(/[^0-9kK]/g, '').toUpperCase();
export function rutValido(valor: string) {
  const rut = normalizarRut(valor);
  if (!/^\d{7,8}[0-9K]$/.test(rut)) return false;
  let suma = 0, factor = 2;
  for (const digito of rut.slice(0, -1).split('').reverse()) {
    suma += Number(digito) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - suma % 11;
  return rut.at(-1) === (resto === 11 ? '0' : resto === 10 ? 'K' : String(resto));
}
export function numeroChileno(valor: string): number {
  const limpio = valor.replace(/[$\s]/g, '');
  if (!/^-?\d+(?:\.\d{3})*(?:,\d+)?$/.test(limpio)) return NaN;
  return Number(limpio.replace(/\./g, '').replace(',', '.'));
}
const lista = <T,>(valor: T | T[] | undefined): T[] => valor === undefined ? [] : Array.isArray(valor) ? valor : [valor];
const texto = (valor: unknown) => typeof valor === 'string' || typeof valor === 'number' ? String(valor) : '';
const numero = (valor: unknown) => {
  const s = texto(valor);
  if (!s) return 0;
  if (!/^-?\d+(\.\d+)?$/.test(s) || !Number.isFinite(Number(s))) throw new Error('El XML contiene un monto o cantidad inválido.');
  return Number(s);
};
export function leerXmlFactura(xml: string): FacturaLectura[] {
  if (xml.length > 5_000_000) throw new Error('El XML supera el límite de 5 MB.');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('No se admiten declaraciones de entidades en el XML.');
  if (XMLValidator.validate(xml) !== true) throw new Error('El archivo no es un XML válido.');
  const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false, trimValues: true });
  const raiz = parser.parse(xml);
  const documentos = lista(raiz.DTE ?? raiz.EnvioDTE?.SetDTE?.DTE);
  if (!documentos.length) throw new Error('No se encontró un DTE o EnvioDTE del SII.');
  if (documentos.length > 100) throw new Error('Importa un archivo con hasta 100 documentos.');
  return documentos.map((dte: any) => {
    const doc = dte.Documento;
    if (!doc?.Encabezado) throw new Error('Falta el encabezado del documento.');
    const { IdDoc: id = {}, Emisor: emisor = {}, Receptor: receptor = {}, Totales: totales = {} } = doc.Encabezado;
    if (!['33', '34'].includes(texto(id.TipoDTE))) throw new Error('Esta prueba admite facturas electrónicas 33 y exentas 34. No admite notas de crédito ni guías.');
    if (doc.Encabezado.OtraMoneda || (totales.TpoMoneda && totales.TpoMoneda !== 'PESO CL')) throw new Error('Esta prueba admite solo facturas en pesos chilenos.');
    const tasa = numero(totales.TasaIVA);
    const bruto = texto(id.MntBruto) === '1';
    if (bruto && numero(totales.IVA) > 0 && !tasa) throw new Error('Falta la tasa de IVA para convertir los precios brutos.');
    const avisos: string[] = [];
    if (doc.DscRcgGlobal) avisos.push('Hay descuentos o recargos globales. Distribúyelos en los montos netos de las líneas antes de cargar los costos.');
    const lineas = lista(doc.Detalle).map((linea: any): LineaFactura => {
      const exento = texto(linea.IndExe) === '1' || texto(id.TipoDTE) === '34';
      if (linea.IndExe && texto(linea.IndExe) !== '1') throw new Error('El documento contiene indicadores de detalle que esta prueba no admite.');
      return { nombre: [texto(linea.NmbItem), texto(linea.DscItem)].filter(Boolean).join(' · '), codigo: texto(lista<any>(linea.CdgItem)[0]?.VlrCodigo), unidad: texto(linea.UnmdItem), cantidad: linea.QtyItem === undefined ? 1 : numero(linea.QtyItem), montoNeto: numero(linea.MontoItem) / (bruto && !exento ? 1 + tasa / 100 : 1), exento, productoId: '' };
    });
    if (!lineas.length || lineas.length > 200) throw new Error('Se requieren entre 1 y 200 líneas de detalle.');
    const otros = lista<any>(totales.ImptoReten).reduce((s, i) => {
      // Las retenciones y créditos no se tratan como impuestos adicionales.
      const tipo = numero(i.TipoImp);
      if ([14, 15].includes(tipo) || tipo >= 18 && tipo <= 53) avisos.push('Revisa impuestos o retenciones especiales con el documento original.');
      return s + numero(i.MontoImp);
    }, 0);
    return { origen: 'xml', tipo: texto(id.TipoDTE), folio: texto(id.Folio), fecha: texto(id.FchEmis), rutEmisor: texto(emisor.RUTEmisor), proveedor: texto(emisor.RznSoc), rutReceptor: texto(receptor.RUTRecep), neto: numero(totales.MntNeto), exento: numero(totales.MntExe), iva: numero(totales.IVA), otros, total: numero(totales.MntTotal), lineas, avisos, original: xml };
  });
}
export function leerTextoFactura(original: string): FacturaLectura {
  const filas = original.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const buscarMonto = (re: RegExp) => {
    const fila = filas.find(s => re.test(s));
    const montos = fila?.match(/\d[\d.]*(?:,\d+)?/g);
    return montos?.length ? numeroChileno(montos.at(-1)!) : 0;
  };
  const ruts = original.match(/\b\d{1,2}\.?\d{3}\.?\d{3}\s*-\s*[0-9kK]\b/g) || [];
  const fecha = original.match(/\b(\d{2})[/-](\d{2})[/-](20\d{2})\b/);
  const folio = original.match(/(?:FOLIO|N[°ºo.]|NUMERO)\s*[:.]?\s*(\d+)/i)?.[1] || '';
  const lineas: LineaFactura[] = [];
  for (const fila of filas) {
    if (/TOTAL|NETO|IVA|RUT|FOLIO|EXENTO|DESCUENTO|RECARGO/i.test(fila)) continue;
    // Solo sugerir líneas con descripción, cantidad, precio y monto inequívocos.
    const m = fila.match(/^(.+?[A-Za-zÁÉÍÓÚÑáéíóúñ].*?)\s+(\d[\d.]*(?:,\d+)?)\s+(\d[\d.]*(?:,\d+)?)\s+(\d[\d.]*(?:,\d+)?)$/);
    if (!m) continue;
    const cantidad = numeroChileno(m[2]), precio = numeroChileno(m[3]), montoNeto = numeroChileno(m[4]);
    if (cantidad > 0 && precio > 0 && Math.abs(cantidad * precio - montoNeto) <= 2) lineas.push({ nombre: m[1], codigo: '', unidad: '', cantidad, montoNeto, exento: false, productoId: '' });
  }
  return { origen: 'foto', tipo: /FACTURA\s+(?:NO\s+AFECTA|EXENTA)/i.test(original) ? '34' : '33', folio, fecha: fecha ? `${fecha[3]}-${fecha[2]}-${fecha[1]}` : '', rutEmisor: ruts.length === 1 ? ruts[0] : '', proveedor: '', rutReceptor: '', neto: buscarMonto(/(?:MONTO\s+)?NETO/i), exento: buscarMonto(/EXENTO/i), iva: buscarMonto(/\bI\.?V\.?A\.?\b/i), otros: 0, total: buscarMonto(/^(?:MONTO\s+)?TOTAL\b/i), lineas, avisos: ['Lectura de foto: comprueba cada campo con el original. Los datos dudosos quedan vacíos.', 'El detalle sugerido puede estar incompleto. Confirma unidades, cantidades, descuentos y montos netos; agrega las líneas que falten.'], original };
}
export function problemasFactura(f: FacturaLectura): string[] {
  const errores: string[] = [];
  if (!['33', '34'].includes(f.tipo)) errores.push('Selecciona factura 33 o exenta 34.');
  if (!rutValido(f.rutEmisor)) errores.push('Revisa el RUT del proveedor.');
  if (!f.proveedor.trim()) errores.push('Completa la razón social del proveedor.');
  if (!/^\d+$/.test(f.folio) || Number(f.folio) <= 0) errores.push('Completa un folio válido.');
  const fecha = new Date(f.fecha + 'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha) || !Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== f.fecha) errores.push('Completa una fecha válida.');
  if (![f.neto, f.exento, f.iva, f.otros, f.total].every(Number.isFinite) || [f.neto, f.exento, f.iva, f.total].some(n => n < 0) || f.total <= 0) errores.push('Revisa los montos de la factura.');
  if (Math.abs(f.neto + f.exento + f.iva + f.otros - f.total) > 1) errores.push('Neto + exento + IVA + otros no coincide con el total.');
  if (!f.lineas.length || f.lineas.some(l => !l.nombre.trim() || !Number.isFinite(l.cantidad) || l.cantidad <= 0 || !Number.isFinite(l.montoNeto) || l.montoNeto <= 0)) errores.push('Completa los productos, cantidades y montos netos positivos.');
  const suma = (exento: boolean) => f.lineas.filter(l => l.exento === exento).reduce((s, l) => s + l.montoNeto, 0);
  if (Math.abs(suma(false) - f.neto) > 2 || Math.abs(suma(true) - f.exento) > 2) errores.push('El detalle neto afecto/exento no cuadra con la cabecera. Revisa descuentos, recargos y líneas faltantes.');
  if (f.tipo === '34' && (f.neto !== 0 || f.iva !== 0 || f.lineas.some(l => !l.exento))) errores.push('Una factura exenta debe tener sus líneas como exentas y no tener neto afecto ni IVA.');
  return errores;
}
