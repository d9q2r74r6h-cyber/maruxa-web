'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';
import type { FacturaLectura } from '@/lib/importar-factura';
type Factura = { id: string; proveedor: string; folio: string; fecha: string; total: number; estado: string; adjunto_id: string; avisos: string[] };
type Adjunto = { id: string; archivo: string; remitente: string; estado: string; mensaje: string | null; duplicadas: number };
export default function FacturasRecibidas({ onReview, disabled }: { onReview: (f: FacturaLectura) => void; disabled: boolean }) {
 const [filas, setFilas] = useState<Factura[]>([]);
 const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
 const [cargando, setCargando] = useState(false);
 const [error, setError] = useState('');
 const [empresaId, setEmpresaId] = useState('');
 const [abriendo, setAbriendo] = useState('');
 const [mas, setMas] = useState(false);
 async function cargar(desde = 0) {
  setCargando(true); setError('');
  try {
   const empresa = await obtenerEmpresaActual();
   if (!empresa) throw new Error('No se pudo identificar la empresa.');
   setEmpresaId(empresa.id);
   const [facturas, errores] = await Promise.all([
    supabase.from('facturas_recibidas').select('id,proveedor,folio,fecha,total,estado,adjunto_id,avisos').eq('empresa_id', empresa.id).order('created_at', { ascending: false }).order('id').range(desde, desde + 24),
    supabase.from('facturas_correo_adjuntos').select('id,archivo,remitente,estado,mensaje,duplicadas').eq('empresa_id', empresa.id).or('estado.neq.procesado,duplicadas.gt.0').order('created_at', { ascending: false }).limit(20),
   ]);
   const fallo = facturas.error || errores.error;
   if (fallo) {
    if (['42P01', 'PGRST205'].includes(fallo.code)) throw new Error('La bandeja está pendiente de activar en la base de datos. La carga manual sigue disponible.');
    throw new Error('No se pudo cargar la bandeja. Comprueba tu sesión y permisos de Compras.');
   }
   setFilas(actual => desde ? [...actual, ...(facturas.data as Factura[])] : facturas.data as Factura[]);
   setAdjuntos(errores.data as Adjunto[]); setMas((facturas.data || []).length === 25);
  } catch(e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la bandeja.'); }
  finally { setCargando(false); }
 }
 useEffect(() => { void cargar(); }, []);
 async function abrir(fila: Factura) {
  setAbriendo(fila.id); setError('');
  try {
   const [factura, archivo] = await Promise.all([
    supabase.from('facturas_recibidas').select('datos').eq('id', fila.id).eq('empresa_id', empresaId).single(),
    supabase.from('facturas_correo_adjuntos').select('xml').eq('id', fila.adjunto_id).eq('empresa_id', empresaId).single(),
   ]);
   if (factura.error || archivo.error || !archivo.data?.xml || !Array.isArray(factura.data?.datos?.lineas)) throw new Error('No se pudo abrir el XML guardado.');
   onReview({ ...factura.data.datos, original: archivo.data.xml });
  } catch(e) { setError(e instanceof Error ? e.message : 'No se pudo abrir la factura.'); }
  finally { setAbriendo(''); }
 }
 return <section className="space-y-3 rounded-xl border border-[#D9C4A7] bg-[#FFF9EF] p-4">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Facturas recibidas por correo</h3><p className="text-sm">recepcion@panaderiamaruxa.cl · Pendientes de revisión</p></div><button type="button" disabled={cargando || disabled} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-50" onClick={() => void cargar()}>Actualizar bandeja</button></div>
  <p className="text-xs">Recibir el XML no confirma la llegada de mercadería ni modifica costos o existencias.</p>
  {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm">{error}</p>}
  {cargando && <p role="status">Cargando facturas…</p>}
  {!cargando && !error && !filas.length && <p>No hay facturas recibidas.</p>}
  {filas.map(f => <article key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3"><div><p className="font-bold">{f.proveedor} · Folio {f.folio}</p><p className="text-sm">{f.fecha} · ${Number(f.total).toLocaleString('es-CL')} · {f.estado === 'revision' ? 'Requiere revisión de datos' : 'Pendiente de revisión'}</p>{f.avisos.map((a, i) => <p className="text-xs text-red-800" key={i}>{a}</p>)}</div><button type="button" disabled={disabled || !!abriendo} onClick={() => void abrir(f)} className="rounded-lg bg-[#A51F2B] px-3 py-2 font-bold text-white disabled:opacity-50">{abriendo === f.id ? 'Abriendo…' : 'Revisar factura'}</button></article>)}
  {mas && <button type="button" disabled={cargando} className="underline" onClick={() => void cargar(filas.length)}>Ver más facturas</button>}
  {!!adjuntos.length && <details><summary className="cursor-pointer font-bold">Archivos pendientes, con errores o duplicados ({adjuntos.length})</summary>{adjuntos.map(a => <div key={a.id} className="mt-2 border-t pt-2 text-sm"><p className="font-bold">{a.archivo} · {a.remitente}</p><p>{a.estado === 'pendiente' ? 'Pendiente de procesamiento o reintento' : a.estado === 'sin_xml' ? 'Sin XML' : a.estado === 'error' ? 'No se pudo importar' : `${a.duplicadas} factura(s) repetida(s)`}</p>{a.mensaje && <p>{a.mensaje}</p>}</div>)}</details>}
 </section>;
}
