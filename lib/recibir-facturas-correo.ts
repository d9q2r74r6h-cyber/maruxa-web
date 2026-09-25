import type { SupabaseClient } from '@supabase/supabase-js';
import type { Resend } from 'resend';
import { leerXmlFactura } from './importar-factura.ts';
import { decodificarXml, leerRespuestaLimitada, prepararFacturaRecibida } from './facturas-correo.ts';

type Correo = { id: string; from: string; subject: string; attachments: { id: string; filename: string | null; size: number; content_type: string }[] };
export async function recibirFacturasCorreo(admin: SupabaseClient, resend: Resend, empresaId: string, correo: Correo) {
  const { data: empresa, error: errorEmpresa } = await admin.from('empresas').select('rut').eq('id', empresaId).single();
  if (errorEmpresa || !empresa?.rut) throw new Error('No se pudo identificar el RUT de la empresa.');
  const xmls = (correo.attachments || []).filter(a => /\.xml$/i.test(a.filename || '') || /^(application|text)\/xml(?:;|$)/i.test(a.content_type));
  const inicio = Date.now();
  async function registrar(adjuntoId: string, archivo: string, estado: string, mensaje: string | null = null) {
    const { error } = await admin.from('facturas_correo_adjuntos').upsert({ empresa_id: empresaId, email_id: correo.id, adjunto_id: adjuntoId, remitente: correo.from, asunto: correo.subject || '', archivo, estado, mensaje }, { onConflict: 'empresa_id,email_id,adjunto_id', ignoreDuplicates: true });
    if (error) throw new Error('No se pudo registrar el adjunto en la bandeja.');
  }
  if (!xmls.length || xmls.length > 20) {
    await registrar('__sin_xml_o_limite__', '(correo)', xmls.length ? 'error' : 'sin_xml', xmls.length ? 'El correo supera 20 XML. Reenvíalos en grupos más pequeños.' : 'El correo no contiene archivos XML. Los ZIP no se descomprimen automáticamente.');
    return;
  }
  for (const adjunto of xmls) {
    await registrar(adjunto.id, adjunto.filename || 'factura.xml', 'pendiente');
    const { data: registro, error: errorRegistro } = await admin.from('facturas_correo_adjuntos').select('id,estado,xml').eq('empresa_id', empresaId).eq('email_id', correo.id).eq('adjunto_id', adjunto.id).single();
    if (errorRegistro || !registro) throw new Error('No se pudo consultar el adjunto.');
    if (registro.estado !== 'pendiente') continue;
    if (Date.now() - inicio > 35000) throw new Error('Recepción parcial; reintentar los adjuntos pendientes.');
    async function actualizar(cambios: Record<string, unknown>) {
      const { error } = await admin.from('facturas_correo_adjuntos').update(cambios).eq('id', registro.id).eq('empresa_id', empresaId);
      if (error) throw new Error('No se pudo actualizar el estado del adjunto.');
    }
    if (adjunto.size > 5_000_000) { await actualizar({ estado: 'error', mensaje: 'El XML supera 5 MB.' }); continue; }
    let xml: string = registro.xml || '';
    if (!xml) {
      const { data, error } = await resend.emails.receiving.attachments.get({ emailId: correo.id, id: adjunto.id });
      if (error || !data) throw new Error('Resend no pudo recuperar el adjunto.');
      if (data.size > 5_000_000) { await actualizar({ estado: 'error', mensaje: 'El XML supera 5 MB.' }); continue; }
      // La URL se obtiene del API autenticado de Resend, nunca del cuerpo del correo.
      const url = new URL(data.download_url);
      if (url.protocol !== 'https:') throw new Error('URL de adjunto no válida.');
      const respuesta = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000), cache: 'no-store' });
      let bytes: Uint8Array;
      try { bytes = await leerRespuestaLimitada(respuesta); }
      catch (error) {
        if (!(error instanceof RangeError)) throw error;
        await actualizar({ estado: 'error', mensaje: error.message });
        continue;
      }
      try { xml = decodificarXml(bytes); }
      catch { await actualizar({ estado: 'error', mensaje: 'No se pudo decodificar el XML. Reenvíalo en UTF-8 o ISO-8859-1.' }); continue; }
      await actualizar({ xml });
    }
    let preparadas: ReturnType<typeof prepararFacturaRecibida>[];
    try { preparadas = leerXmlFactura(xml).map(f => prepararFacturaRecibida(f, empresa.rut)); }
    catch (error) {
      await actualizar({ estado: 'error', mensaje: error instanceof Error ? error.message : 'El XML no pudo leerse.' });
      continue;
    }
    let creadas = 0, duplicadas = 0, diferentes = 0;
    for (const factura of preparadas) {
      const { error } = await admin.from('facturas_recibidas').insert({ ...factura, empresa_id: empresaId, adjunto_id: registro.id });
      if (!error) { creadas++; continue; }
      if (error.code !== '23505') throw new Error('No se pudo guardar la factura recibida.');
      const { data: existente, error: consultaError } = await admin.from('facturas_recibidas').select('adjunto_id,total,datos').eq('empresa_id', empresaId).eq('rut_emisor', factura.rut_emisor).eq('tipo', factura.tipo).eq('folio', factura.folio).single();
      if (consultaError || !existente) throw new Error('No se pudo comprobar el duplicado.');
      if (existente.adjunto_id === registro.id) creadas++;
      else {
        duplicadas++;
        if (Number(existente.total) !== factura.total || JSON.stringify(existente.datos.lineas) !== JSON.stringify(factura.datos.lineas)) diferentes++;
      }
    }
    await actualizar({ estado: 'procesado', creadas, duplicadas, mensaje: diferentes ? 'Hay documentos repetidos con montos o detalle distintos. Se conservó la primera factura; revisa ambos XML.' : duplicadas ? 'Las facturas repetidas ya estaban en la bandeja y no se volvieron a crear.' : null });
  }
}
