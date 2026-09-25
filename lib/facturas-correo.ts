import { normalizarRut, problemasFactura, rutValido, type FacturaLectura } from './importar-factura.ts';

export const CORREO_FACTURAS = 'recepcion@panaderiamaruxa.cl';
export function prepararFacturaRecibida(f: FacturaLectura, rutEmpresa: string) {
  if (!rutValido(rutEmpresa) || normalizarRut(f.rutReceptor) !== normalizarRut(rutEmpresa)) throw new Error('El RUT receptor del XML no corresponde a la empresa.');
  if (!rutValido(f.rutEmisor) || !/^\d{1,18}$/.test(f.folio) || BigInt(f.folio) <= BigInt(0)) throw new Error('El XML no tiene RUT emisor y folio válidos.');
  const fecha = new Date(f.fecha + 'T12:00:00Z');
  if (!Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== f.fecha) throw new Error('La fecha de emisión no es válida.');
  const { original, ...datos } = f;
  const avisos = [...f.avisos, ...problemasFactura(f)];
  return { rut_emisor: normalizarRut(f.rutEmisor), tipo: f.tipo, folio: BigInt(f.folio).toString(), proveedor: f.proveedor, fecha: f.fecha, total: f.total, estado: avisos.length ? 'revision' : 'pendiente', datos, avisos };
}
export function decodificarXml(bytes: Uint8Array) {
  const cabecera = new TextDecoder().decode(bytes.subarray(0, 200));
  const encoding = /encoding\s*=\s*["']([^"']+)/i.exec(cabecera)?.[1] || 'utf-8';
  return new TextDecoder(encoding, { fatal: true }).decode(bytes);
}
export async function leerRespuestaLimitada(respuesta: Response, limite = 5_000_000) {
  if (!respuesta.ok) throw new Error('No se pudo descargar el adjunto.');
  if (Number(respuesta.headers.get('content-length')) > limite) throw new RangeError('El XML supera 5 MB.');
  if (!respuesta.body) throw new Error('El adjunto está vacío.');
  const lector = respuesta.body.getReader();
  const partes: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { value, done } = await lector.read();
      if (done) break;
      total += value.length;
      if (total > limite) { await lector.cancel(); throw new RangeError('El XML supera 5 MB.'); }
      partes.push(value);
    }
  } finally { lector.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const parte of partes) { bytes.set(parte, offset); offset += parte.length; }
  return bytes;
}
