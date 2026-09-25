'use client';

import { useEffect, useRef, useState } from 'react';
import type { Worker } from 'tesseract.js';
import FacturasRecibidas from '@/components/FacturasRecibidas';
import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';
import { leerXmlFactura, leerTextoFactura, normalizarRut, problemasFactura, type FacturaLectura, type LineaFactura } from '@/lib/importar-factura';

export type ProductoFactura = {
  id: number; nombre: string; codigo: string | null; tipo_producto: string;
  familia_id: string | null; unidad_base: string | null; stock_actual: number | null;
  costo_unitario: number | null; precio: number | null; proveedor_id?: string | null;
  controla_stock: boolean | null; usar_configuracion_familia?: boolean | null;
  margen_personalizado?: number | null; tipo_margen_personalizado?: 'markup' | 'margen_comercial' | null;
};
export type ProveedorFactura = { id: string; razon_social: string; nombre_fantasia: string | null; rut: string | null; precio_iva_incluido: boolean };
export type CargaFactura = { factura: FacturaLectura; proveedor: ProveedorFactura; productos: ProductoFactura[] };
const campo = 'w-full rounded-lg border border-[#D9C4A7] bg-white p-2 text-sm text-[#2A1710]';
const boton = 'rounded-xl bg-[#A51F2B] px-4 py-3 font-bold text-white disabled:opacity-50';
const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CL');

function Buscador({ empresaId, tabla, onSelect }: { empresaId: string; tabla: 'productos' | 'proveedores'; onSelect: (valor: any) => void }) {
  const [texto, setTexto] = useState('');
  const [opciones, setOpciones] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [buscando, setBuscando] = useState(false);
  useEffect(() => {
    let vigente = true;
    setOpciones([]);
    setError('');
    setBuscando(false);
    if (texto.trim().length < 2 || !empresaId) return;
    const timer = setTimeout(async () => {
      setBuscando(true);
      const termino = texto.replace(/[^\p{L}\p{N}\s-]/gu, '').trim();
      if (!termino) { setBuscando(false); return; }
      const columnas = tabla === 'productos' ? 'id,nombre,codigo,tipo_producto,familia_id,unidad_base,stock_actual,costo_unitario,precio,proveedor_id,controla_stock,usar_configuracion_familia,margen_personalizado,tipo_margen_personalizado' : 'id,razon_social,nombre_fantasia,rut,precio_iva_incluido';
      const { data, error: fallo } = await supabase.from(tabla).select(columnas).eq('empresa_id', empresaId).eq('activo', true).ilike(tabla === 'productos' ? 'nombre' : 'razon_social', `%${termino}%`).limit(15);
      if (!vigente) return;
      setBuscando(false);
      setOpciones(data || []);
      if (fallo) setError('No se pudo buscar. Vuelve a escribir para reintentar.');
    }, 300);
    return () => { vigente = false; clearTimeout(timer); };
  }, [texto, empresaId, tabla]);
  return <div>
    <input className={campo} aria-label={tabla === 'productos' ? 'Buscar producto del catálogo' : 'Buscar proveedor por razón social'} placeholder={tabla === 'productos' ? 'Buscar por nombre…' : 'Buscar proveedor por razón social…'} value={texto} onChange={e => setTexto(e.target.value)} />
    {buscando && <p className="text-xs">Buscando…</p>}
    {error && <p role="alert">{error}</p>}
    <div className="max-h-48 overflow-auto">{opciones.map(o => <button key={o.id} type="button" className="block w-full border-b bg-white p-2 text-left text-sm hover:bg-amber-50" onClick={() => { onSelect(o); setTexto(''); setOpciones([]); }}>{o.nombre || o.razon_social} · {o.unidad_base || o.rut || o.codigo || ''}</button>)}</div>
  </div>;
}

export default function ImportarFactura({ onApply }: { onApply: (carga: CargaFactura) => Promise<void> }) {
  const [abierto, setAbierto] = useState(false);
  const [empresa, setEmpresa] = useState<{ id: string; rut: string } | null>(null);
  const [documentos, setDocumentos] = useState<FacturaLectura[]>([]);
  const [indice, setIndice] = useState(0);
  const [proveedor, setProveedor] = useState<ProveedorFactura | null>(null);
  const [productos, setProductos] = useState<Record<string, ProductoFactura>>({});
  const [revisado, setRevisado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [progreso, setProgreso] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [imagenes, setImagenes] = useState<string[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const operacion = useRef(0);
  const lectorXml = useRef<HTMLInputElement>(null);
  const lectorFotos = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);
  const factura = documentos[indice];
  useEffect(() => () => { imagenes.forEach(url => URL.revokeObjectURL(url)); }, [imagenes]);
  useEffect(() => () => { operacion.current++; void workerRef.current?.terminate(); }, []);
  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    obtenerEmpresaActual().then(e => { if (vigente) { setEmpresa(e); if (!e) setError('No se pudo identificar la empresa.'); } });
    return () => { vigente = false; };
  }, [abierto]);
  function modificar(cambios: Partial<FacturaLectura>) {
    setDocumentos(actuales => actuales.map((f, i) => i === indice ? { ...f, ...cambios } : f));
    setRevisado(false);
    setMensaje('');
  }
  function linea(i: number, cambios: Partial<LineaFactura>) {
    modificar({ lineas: factura.lineas.map((l, n) => n === i ? { ...l, ...cambios } : l) });
  }
  async function leer(archivos: File[], tipo: 'xml' | 'foto') {
    if (!archivos.length) return;
    if (documentos.length && !window.confirm('¿Reemplazar la revisión actual con este archivo?')) return;
    const id = ++operacion.current;
    setOcupado(true); setError(''); setMensaje(''); setProgreso('Preparando lectura…');
    let worker: Worker | null = null;
    let activo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (tipo === 'xml') {
        if (archivos.length !== 1 || archivos[0].size > 5_000_000) throw new Error('Selecciona un XML de hasta 5 MB.');
        const buffer = await archivos[0].arrayBuffer();
        const cabecera = new TextDecoder().decode(buffer.slice(0, 200));
        const encoding = /encoding\s*=\s*["']([^"']+)/i.exec(cabecera)?.[1] || 'utf-8';
        const xml = new TextDecoder(encoding, { fatal: true }).decode(buffer);
        const resultado = leerXmlFactura(xml);
        if (id !== operacion.current) return;
        setDocumentos(resultado); setImagenes([]);
      } else {
        if (archivos.length > 5 || archivos.some(a => a.size > 12_000_000 || !/\.(jpe?g|png|webp)$/i.test(a.name))) throw new Error('Selecciona hasta 5 fotos JPG, PNG o WebP de 12 MB cada una.');
        const trabajo = async () => {
          const { createWorker } = await import('tesseract.js');
          worker = await createWorker('spa', 1, { errorHandler: () => {}, logger: m => {
            if (id === operacion.current) setProgreso(m.status === 'recognizing text' ? `Leyendo página: ${Math.round(m.progress * 100)}%` : 'Cargando lector de fotos… La primera vez puede tardar.');
          } });
          if (!activo || id !== operacion.current) { await worker.terminate(); return ''; }
          workerRef.current = worker;
          await worker.setParameters({ preserve_interword_spaces: '1' });
          const textos: string[] = [];
          for (const archivo of archivos) {
            if (id !== operacion.current) return '';
            const { data } = await worker.recognize(archivo);
            textos.push(data.text);
          }
          return textos.join('\n\n');
        };
        const texto = await Promise.race([trabajo(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('La lectura tardó demasiado. Prueba con una foto más nítida o menos páginas.')), 120000); })]);
        if (id !== operacion.current) return;
        if (!texto.trim()) throw new Error('No se pudo leer texto. Prueba una foto enfocada y sin reflejos.');
        setDocumentos([leerTextoFactura(texto)]);
        setImagenes(archivos.map(a => URL.createObjectURL(a)));
      }
      setIndice(0); setProveedor(null); setProductos({}); setRevisado(false);
    } catch (e) {
      if (id === operacion.current) setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
    } finally {
      activo = false;
      clearTimeout(timer);
      if (worker) await (worker as Worker).terminate().catch(() => {});
      if (id === operacion.current) { workerRef.current = null; setOcupado(false); }
    }
  }
  const problemas = factura ? problemasFactura(factura) : [];
  const rutDistinto = factura?.rutReceptor && empresa?.rut && normalizarRut(factura.rutReceptor) !== normalizarRut(empresa.rut);
  if (rutDistinto) problemas.push('El RUT receptor no corresponde a esta empresa.');
  if (factura && (!proveedor || normalizarRut(proveedor.rut || '') !== normalizarRut(factura.rutEmisor))) problemas.push('Selecciona un proveedor del sistema con el mismo RUT emisor.');
  if (factura?.lineas.some(l => !l.productoId || !productos[l.productoId])) problemas.push('Asocia cada línea a un producto del catálogo.');
  async function aplicar() {
    if (!factura || !proveedor || !empresa || problemas.length || !revisado || aplicando) return;
    setAplicando(true); setError('');
    try {
      await onApply({ factura, proveedor, productos: Object.values(productos) });
      setMensaje('Costos cargados en el formulario. Revísalos y usa Guardar costos y precios para confirmarlos. Esta acción solo prepara costos; no confirma la compra ni registra mercadería.');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los costos.'); }
    finally { setAplicando(false); }
  }
  function descargar() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(factura, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `revision-factura-${factura.folio || 'sin-folio'}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="my-5 rounded-2xl border border-[#D9C4A7] bg-white p-5">
    <button type="button" className={boton} aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>Capturar factura / Importar XML</button>
    {abierto && <div className="mt-4 space-y-4">
      <FacturasRecibidas disabled={ocupado || aplicando} onReview={f => {
        if (documentos.length && !window.confirm('¿Reemplazar la revisión actual con la factura recibida?')) return;
        setDocumentos([f]); setIndice(0); setProveedor(null); setProductos({}); setRevisado(false); setImagenes([]); setError(''); setMensaje('');
      }} />
      <h2 className="text-xl font-bold">Revisar factura</h2>
      <p className="text-sm">Sube el XML o fotos de todas las páginas de una misma factura. Revisa los datos y vincula los productos antes de cargar sus costos. La carga manual no registra la factura ni sus archivos en el sistema; puedes descargar la revisión. Los XML recibidos por correo sí se conservan en la bandeja.</p>
      <div className="flex flex-wrap gap-3">
        <button className={boton} type="button" disabled={ocupado || aplicando} onClick={() => camara.current?.click()}>Tomar foto</button>
        <button className={boton} type="button" disabled={ocupado || aplicando} onClick={() => lectorFotos.current?.click()}>Subir fotos</button>
        <button className={boton} type="button" disabled={ocupado || aplicando} onClick={() => lectorXml.current?.click()}>Importar XML</button>
      </div>
      <input hidden ref={camara} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => { void leer(Array.from(e.target.files || []), 'foto'); e.target.value = ''; }} />
      <input hidden ref={lectorFotos} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { void leer(Array.from(e.target.files || []), 'foto'); e.target.value = ''; }} />
      <input hidden ref={lectorXml} type="file" accept=".xml,application/xml,text/xml" onChange={e => { void leer(Array.from(e.target.files || []), 'xml'); e.target.value = ''; }} />
      <p className="text-xs">Las fotos se leen en tu navegador. Se necesita conexión para descargar el lector la primera vez. No se requiere token del SII.</p>
      {ocupado && <div><p role="status">{progreso}</p><button type="button" className="mt-2 underline" onClick={() => { operacion.current++; void workerRef.current?.terminate(); workerRef.current = null; setOcupado(false); }}>Cancelar lectura</button></div>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      {factura && !ocupado && <fieldset disabled={aplicando} className="space-y-4">
        {documentos.length > 1 && <label>Documento del XML<select className={campo} value={indice} onChange={e => { setIndice(Number(e.target.value)); setProveedor(null); setRevisado(false); setMensaje(''); }}>{documentos.map((f, i) => <option key={i} value={i}>{f.proveedor} · Folio {f.folio} · {pesos(f.total)}</option>)}</select></label>}
        {factura.avisos.map((a, i) => <p key={i} className="rounded-lg bg-amber-50 p-3 text-sm">{a}</p>)}
        <details><summary className="cursor-pointer font-bold">Ver original y texto leído</summary>
          <div className="flex flex-wrap gap-3">{imagenes.map((url, i) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Factura, página ${i + 1}`} className="max-h-96 max-w-full object-contain" /></a>)}</div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">{factura.original}</pre>
        </details>
        <div className="grid gap-3 md:grid-cols-3">
          <label>Tipo<select className={campo} value={factura.tipo} onChange={e => modificar({ tipo: e.target.value })}><option value="33">Factura electrónica</option><option value="34">Factura exenta</option></select></label>
          {(['folio', 'rutEmisor', 'proveedor', 'rutReceptor', 'fecha'] as const).map(k => <label key={k}>{({ folio: 'Folio', rutEmisor: 'RUT proveedor', proveedor: 'Razón social proveedor', rutReceptor: 'RUT receptor', fecha: 'Fecha de emisión' })[k]}<input className={campo} type={k === 'fecha' ? 'date' : 'text'} value={factura[k]} onChange={e => modificar({ [k]: e.target.value })} /></label>)}
        </div>
        <label className="block">Proveedor del sistema {proveedor && <strong>· {proveedor.razon_social} ({proveedor.rut})</strong>}
          <Buscador tabla="proveedores" empresaId={empresa?.id || ''} onSelect={p => { setProveedor(p); setRevisado(false); }} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{(['neto', 'exento', 'iva', 'otros', 'total'] as const).map(k => <label key={k}>{({ neto: 'Neto afecto', exento: 'Exento', iva: 'IVA', otros: 'Otros (+/−)', total: 'Total factura' })[k]}<input type="number" step="any" className={campo} value={Number.isFinite(factura[k]) ? factura[k] : ''} onChange={e => modificar({ [k]: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>)}</div>
        <h3 className="font-bold">Detalle · montos netos después de descuentos</h3>
        <p className="text-sm">La cantidad debe estar expresada en la unidad del producto del catálogo. Si compras cajas y el catálogo usa kilos o unidades, convierte la cantidad antes de continuar; el monto de la línea se conserva.</p>
        {factura.lineas.map((l, i) => <div key={i} className="grid gap-3 rounded-xl border p-3 md:grid-cols-3">
          <label>Descripción<input className={campo} value={l.nombre} onChange={e => linea(i, { nombre: e.target.value })} /><span className="text-xs">Código origen: {l.codigo || '—'} · Unidad origen: {l.unidad || 'Sin indicar'}</span></label>
          <label>Cantidad<input className={campo} type="number" min="0" step="any" value={l.cantidad} onChange={e => linea(i, { cantidad: Number(e.target.value) })} /></label>
          <label>Monto neto de la línea<input className={campo} type="number" min="0" step="any" value={Number(l.montoNeto.toFixed(4))} onChange={e => linea(i, { montoNeto: Number(e.target.value) })} /></label>
          <div className="md:col-span-2"><p className="text-sm font-bold">{productos[l.productoId] ? `${productos[l.productoId].nombre} · Unidad: ${productos[l.productoId].unidad_base || 'Sin indicar'}` : 'Selecciona el producto del catálogo'}</p><Buscador tabla="productos" empresaId={empresa?.id || ''} onSelect={(p: ProductoFactura) => { setProductos(actual => ({ ...actual, [p.id]: p })); linea(i, { productoId: String(p.id) }); }} /></div>
          <div><label><input type="checkbox" checked={l.exento} onChange={e => linea(i, { exento: e.target.checked })} /> Exento</label><p className="text-sm">Costo neto por unidad: {l.cantidad > 0 ? pesos(l.montoNeto / l.cantidad) : '—'}</p><button type="button" className="text-red-800 underline" onClick={() => modificar({ lineas: factura.lineas.filter((_, n) => n !== i) })}>Quitar línea</button></div>
        </div>)}
        <button type="button" className="rounded-lg border px-4 py-2" onClick={() => modificar({ lineas: [...factura.lineas, { nombre: '', codigo: '', unidad: '', cantidad: 1, montoNeto: 0, exento: factura.tipo === '34', productoId: '' }] })}>+ Agregar línea</button>
        {problemas.length > 0 && <ul className="list-disc rounded-lg bg-amber-50 py-3 pl-8 text-sm">{problemas.map((p, i) => <li key={i}>{p}</li>)}</ul>}
        <label className="flex items-start gap-2 font-bold"><input type="checkbox" checked={revisado} onChange={e => setRevisado(e.target.checked)} /> Revisé el original, los montos y las unidades de todos los productos.</label>
        <div className="flex flex-wrap gap-3"><button type="button" className={boton} disabled={!empresa || problemas.length > 0 || !revisado || aplicando || !!mensaje} onClick={() => void aplicar()}>{aplicando ? 'Cargando…' : 'Cargar costos revisados'}</button><button type="button" className="rounded-lg border px-4 py-2" onClick={descargar}>Descargar revisión</button></div>
        {mensaje && <p role="status" className="rounded-lg bg-green-50 p-3">{mensaje}</p>}
      </fieldset>}
    </div>}
  </section>;
}
