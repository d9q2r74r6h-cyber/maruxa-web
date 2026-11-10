'use client';

import { useEffect, useRef, useState } from 'react';
import FacturasRecibidas from '@/components/FacturasRecibidas';
import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';
import { leerXmlFactura, normalizarRut, problemasFactura, type FacturaLectura, type LineaFactura } from '@/lib/importar-factura';

export type ProductoFactura = {
  id: number; nombre: string; codigo: string | null; tipo_producto: string;
  familia_id: string | null; unidad_base: string | null; undxcaja?: number | null; stock_actual: number | null;
  costo_unitario: number | null; precio: number | null; proveedor_id?: string | null;
  controla_stock: boolean | null; usar_configuracion_familia?: boolean | null;
  margen_personalizado?: number | null; tipo_margen_personalizado?: 'markup' | 'margen_comercial' | null;
};
export type TipoProductoFactura = 'producto' | 'ingrediente' | 'envase';
export type ProductoNuevoFactura = { indice: number; tipo_producto: TipoProductoFactura };
export type PresentacionCompraFactura = { indice: number; compra_por_caja: boolean };
export type ProveedorFactura = { id: string; razon_social: string; nombre_fantasia: string | null; rut: string | null; precio_iva_incluido: boolean };
export type CargaFactura = {
  factura: FacturaLectura; proveedor: ProveedorFactura; productos: ProductoFactura[];
  nuevos: ProductoNuevoFactura[]; presentaciones: PresentacionCompraFactura[];
};
const campo = 'w-full rounded-lg border border-[#D9C4A7] bg-white p-2 text-sm text-[#2A1710]';
const boton = 'rounded-xl bg-[#A51F2B] px-4 py-3 font-bold text-white disabled:opacity-50';
const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CL');
const MAX_BYTES_ENVIO_FOTOS = 4_000_000;
const normalizarCodigoProveedor = (codigo: string) => codigo.toLocaleUpperCase('es-CL').replace(/[^\p{L}\p{N}]/gu, '');

async function convertirFotoParaVision(archivo: File, ladoMaximo: number, calidad: number): Promise<File> {
  const imagen = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const elemento = new Image();
    elemento.onload = () => { URL.revokeObjectURL(url); resolve(elemento); };
    elemento.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo preparar una de las fotos.')); };
    elemento.src = url;
  });
  const escala = Math.min(1, ladoMaximo / Math.max(imagen.naturalWidth, imagen.naturalHeight));
  const ancho = Math.max(1, Math.round(imagen.naturalWidth * escala));
  const alto = Math.max(1, Math.round(imagen.naturalHeight * escala));
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('Tu navegador no pudo preparar la foto.');
  contexto.fillStyle = '#FFFFFF';
  contexto.fillRect(0, 0, ancho, alto);
  contexto.drawImage(imagen, 0, 0, ancho, alto);
  const blob = await new Promise<Blob | null>(resolve => lienzo.toBlob(resolve, 'image/jpeg', calidad));
  if (!blob) throw new Error('No se pudo comprimir una de las fotos.');
  return new File([blob], `${archivo.name.replace(/\.[^.]+$/, '') || 'factura'}.jpg`, { type: 'image/jpeg' });
}

async function prepararFotosParaVision(archivos: File[]): Promise<File[]> {
  if (archivos.reduce((total, archivo) => total + archivo.size, 0) <= MAX_BYTES_ENVIO_FOTOS) return archivos;
  let fotos = await Promise.all(archivos.map(archivo => convertirFotoParaVision(archivo, 2400, 0.9)));
  if (fotos.reduce((total, foto) => total + foto.size, 0) > MAX_BYTES_ENVIO_FOTOS) {
    fotos = await Promise.all(archivos.map(archivo => convertirFotoParaVision(archivo, 1800, 0.82)));
  }
  if (fotos.reduce((total, foto) => total + foto.size, 0) > MAX_BYTES_ENVIO_FOTOS) {
    fotos = await Promise.all(archivos.map(archivo => convertirFotoParaVision(archivo, 1400, 0.74)));
  }
  if (fotos.reduce((total, foto) => total + foto.size, 0) > MAX_BYTES_ENVIO_FOTOS) {
    throw new Error('Las fotos pesan demasiado incluso después de prepararlas. Sube menos páginas o toma una foto más cercana de cada página.');
  }
  return fotos;
}

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
      const columnas = tabla === 'productos' ? 'id,nombre,codigo,tipo_producto,familia_id,unidad_base,undxcaja,stock_actual,costo_unitario,precio,proveedor_id,controla_stock,usar_configuracion_familia,margen_personalizado,tipo_margen_personalizado' : 'id,razon_social,nombre_fantasia,rut,precio_iva_incluido';
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
  const [tiposProductoNuevo, setTiposProductoNuevo] = useState<Record<number, TipoProductoFactura>>({});
  const [comprasPorCaja, setComprasPorCaja] = useState<Record<number, boolean>>({});
  const [asociadosPorCodigo, setAsociadosPorCodigo] = useState<Record<string, boolean>>({});
  const [revisado, setRevisado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [progreso, setProgreso] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [imagenes, setImagenes] = useState<string[]>([]);
  const operacion = useRef(0);
  const lectorXml = useRef<HTMLInputElement>(null);
  const lectorFotos = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);
  const factura = documentos[indice];
  useEffect(() => () => { imagenes.forEach(url => URL.revokeObjectURL(url)); }, [imagenes]);
  useEffect(() => () => { operacion.current++; }, []);
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
  async function asociarProductosPorCodigo(documento: FacturaLectura, proveedorSeleccionado: ProveedorFactura, documentoIndice = indice) {
    const empresaActual = empresa || await obtenerEmpresaActual();
    const codigos = [...new Set(documento.lineas.map(linea => normalizarCodigoProveedor(linea.codigo)).filter(Boolean))];
    if (!empresaActual || !codigos.length) return;

    const { data: equivalencias, error: errorEquivalencias } = await supabase
      .from('productos_proveedor')
      .select('producto_id,codigo_proveedor,compra_por_caja')
      .eq('empresa_id', empresaActual.id)
      .eq('proveedor_id', proveedorSeleccionado.id)
      .in('codigo_proveedor', codigos);
    if (errorEquivalencias || !equivalencias?.length) return;

    const ids = [...new Set(equivalencias.map(item => Number(item.producto_id)).filter(Number.isFinite))];
    const { data: productosEncontrados, error: errorProductos } = await supabase
      .from('productos')
      .select('id,nombre,codigo,tipo_producto,familia_id,unidad_base,undxcaja,stock_actual,costo_unitario,precio,proveedor_id,controla_stock,usar_configuracion_familia,margen_personalizado,tipo_margen_personalizado')
      .eq('empresa_id', empresaActual.id)
      .eq('activo', true)
      .in('id', ids);
    if (errorProductos || !productosEncontrados?.length) return;

    const productoPorId = new Map((productosEncontrados as ProductoFactura[]).map(item => [String(item.id), item]));
    const productoPorCodigo = new Map(
      equivalencias
        .map(item => {
          const producto = productoPorId.get(String(item.producto_id));
          return producto ? [String(item.codigo_proveedor), { producto, compraPorCaja: Boolean(item.compra_por_caja) }] as const : null;
        })
        .filter((item): item is readonly [string, { producto: ProductoFactura; compraPorCaja: boolean }] => Boolean(item))
    );
    const encontrados: Record<string, ProductoFactura> = {};
    const clavesAsociadas: Record<string, boolean> = {};
    const cajasAsociadas: Record<number, boolean> = {};
    const lineas = documento.lineas.map((linea, lineaIndice) => {
      if (linea.productoId) return linea;
      const equivalencia = productoPorCodigo.get(normalizarCodigoProveedor(linea.codigo));
      if (!equivalencia) return linea;
      const { producto: productoEncontrado, compraPorCaja } = equivalencia;
      encontrados[String(productoEncontrado.id)] = productoEncontrado;
      clavesAsociadas[`${documentoIndice}:${lineaIndice}`] = true;
      cajasAsociadas[lineaIndice] = compraPorCaja;
      return { ...linea, productoId: String(productoEncontrado.id) };
    });
    if (!Object.keys(encontrados).length) return;
    setProductos(actual => ({ ...actual, ...encontrados }));
    setDocumentos(actuales => actuales.map((actual, actualIndice) => actualIndice === documentoIndice ? { ...actual, lineas } : actual));
    setAsociadosPorCodigo(actual => ({ ...actual, ...clavesAsociadas }));
    setComprasPorCaja(actual => ({ ...actual, ...cajasAsociadas }));
  }

  async function seleccionarProveedorAutomatico(documento: FacturaLectura, documentoIndice = indice) {
    const empresaActual = empresa || await obtenerEmpresaActual();
    const rutEmisor = normalizarRut(documento.rutEmisor);
    if (!empresaActual || !rutEmisor) return;
    const { data } = await supabase
      .from('proveedores')
      .select('id,razon_social,nombre_fantasia,rut,precio_iva_incluido')
      .eq('empresa_id', empresaActual.id)
      .eq('activo', true);
    const coincidencia = (data || []).find(
      (item) => normalizarRut(item.rut || '') === rutEmisor
    );
    if (coincidencia) {
      const proveedorEncontrado = coincidencia as ProveedorFactura;
      setProveedor(proveedorEncontrado);
      await asociarProductosPorCodigo(documento, proveedorEncontrado, documentoIndice);
    }
  }
  async function leerFotoConVision(archivos: File[]): Promise<FacturaLectura> {
    const { data: sesion } = await supabase.auth.getSession();
    if (!sesion.session?.access_token) throw new Error('Tu sesión venció. Ingresa nuevamente antes de leer la factura.');
    setProgreso('Preparando las fotos para su lectura…');
    const fotos = await prepararFotosParaVision(archivos);
    setProgreso('Analizando la factura y sus líneas…');
    const formulario = new FormData();
    fotos.forEach(foto => formulario.append('fotos', foto));
    const respuesta = await fetch('/api/facturas/leer-foto', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sesion.session.access_token}` },
      body: formulario,
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(typeof datos.error === 'string' ? datos.error : 'No se pudo leer la factura.');
    return datos as FacturaLectura;
  }
  async function leer(archivos: File[], tipo: 'xml' | 'foto') {
    if (!archivos.length) return;
    if (documentos.length && !window.confirm('¿Reemplazar la revisión actual con este archivo?')) return;
    const id = ++operacion.current;
    setOcupado(true); setError(''); setMensaje(''); setProgreso('Preparando lectura…');
    setProveedor(null); setProductos({}); setTiposProductoNuevo({}); setComprasPorCaja({}); setAsociadosPorCodigo({}); setRevisado(false);
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
        await seleccionarProveedorAutomatico(resultado[0], 0);
      } else {
        if (archivos.length > 5 || archivos.some(a => a.size > 12_000_000 || !/\.(jpe?g|png|webp)$/i.test(a.name))) throw new Error('Selecciona hasta 5 fotos JPG, PNG o WebP de 12 MB cada una.');
        const resultado = await leerFotoConVision(archivos);
        if (id !== operacion.current) return;
        setDocumentos([resultado]);
        setImagenes(archivos.map(a => URL.createObjectURL(a)));
        await seleccionarProveedorAutomatico(resultado, 0);
      }
      setIndice(0);
    } catch (e) {
      if (id === operacion.current) setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
    } finally {
      if (id === operacion.current) setOcupado(false);
    }
  }
  const problemas = factura ? problemasFactura(factura) : [];
  const rutDistinto = factura?.rutReceptor && empresa?.rut && normalizarRut(factura.rutReceptor) !== normalizarRut(empresa.rut);
  if (rutDistinto) problemas.push('El RUT receptor no corresponde a esta empresa.');
  if (factura && (!proveedor || normalizarRut(proveedor.rut || '') !== normalizarRut(factura.rutEmisor))) problemas.push('Selecciona un proveedor del sistema con el mismo RUT emisor.');
  if (factura?.lineas.some((lineaFactura, lineaIndice) => !lineaFactura.productoId || !productos[lineaFactura.productoId] ? !tiposProductoNuevo[lineaIndice] : false)) {
    problemas.push('Asocia cada línea a un producto existente o selecciona el tipo para crear uno nuevo.');
  }
  async function aplicar() {
    if (!factura || !proveedor || !empresa || problemas.length || !revisado || aplicando) return;
    setAplicando(true); setError('');
    try {
      const nuevos = factura.lineas.flatMap((lineaFactura, lineaIndice) => {
        if (lineaFactura.productoId && productos[lineaFactura.productoId]) return [];
        const tipo = tiposProductoNuevo[lineaIndice];
        return tipo ? [{ indice: lineaIndice, tipo_producto: tipo }] : [];
      });
      const presentaciones = factura.lineas.map((_, lineaIndice) => ({
        indice: lineaIndice,
        compra_por_caja: Boolean(comprasPorCaja[lineaIndice]),
      }));
      await onApply({ factura, proveedor, productos: Object.values(productos), nuevos, presentaciones });
      setMensaje('La factura quedó preparada en el formulario. Revisa la grilla y usa Registrar factura para confirmar la compra, costos y stock.');
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
        setDocumentos([f]); setIndice(0); setProveedor(null); setProductos({}); setTiposProductoNuevo({}); setComprasPorCaja({}); setAsociadosPorCodigo({}); setRevisado(false); setImagenes([]); setError(''); setMensaje('');
        void seleccionarProveedorAutomatico(f, 0);
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
      <p className="text-xs">Las fotos se preparan automáticamente para enviarlas al lector visual y reconocer la factura; no se almacenan en la aplicación. No se requiere token del SII.</p>
      {ocupado && <div><p role="status">{progreso}</p><button type="button" className="mt-2 underline" onClick={() => { operacion.current++; setOcupado(false); }}>Cancelar lectura</button></div>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      {factura && !ocupado && <fieldset disabled={aplicando} className="space-y-4">
        {documentos.length > 1 && <label>Documento del XML<select className={campo} value={indice} onChange={e => {
          const nuevoIndice = Number(e.target.value);
          setIndice(nuevoIndice); setProveedor(null); setProductos({}); setTiposProductoNuevo({}); setComprasPorCaja({}); setAsociadosPorCodigo({}); setRevisado(false); setMensaje('');
          void seleccionarProveedorAutomatico(documentos[nuevoIndice], nuevoIndice);
        }}>{documentos.map((f, i) => <option key={i} value={i}>{f.proveedor} · Folio {f.folio} · {pesos(f.total)}</option>)}</select></label>}
        {factura.avisos.map((a, i) => <p key={i} className="rounded-lg bg-amber-50 p-3 text-sm">{a}</p>)}
        <section className="rounded-xl border border-[#D9C4A7] bg-[#FFF8ED] p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#A51F2B]">Revisión rápida</p>
          <h3 className="mt-1 font-black text-[#2A1710]">Solo confirma proveedor y productos</h3>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <p><span className="font-bold">Folio:</span> {factura.folio || 'Sin leer'}</p>
            <p><span className="font-bold">Fecha:</span> {factura.fecha || 'Sin leer'}</p>
            <p><span className="font-bold">Total:</span> {pesos(factura.total)}</p>
          </div>
          <label className="mt-4 block font-bold">Proveedor del sistema {proveedor && <strong>· {proveedor.razon_social}</strong>}
            <Buscador tabla="proveedores" empresaId={empresa?.id || ''} onSelect={p => {
              setProveedor(p); setRevisado(false);
              void asociarProductosPorCodigo(factura, p, indice);
            }} />
          </label>
          <p className="mt-2 text-xs text-[#5F4030]">Si el RUT coincide, el proveedor se selecciona automáticamente. Con proveedor y código registrados, las líneas también se asocian solas.</p>
        </section>
        <details><summary className="cursor-pointer font-bold">Ver original y texto leído</summary>
          <div className="flex flex-wrap gap-3">{imagenes.map((url, i) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Factura, página ${i + 1}`} className="max-h-96 max-w-full object-contain" /></a>)}</div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">{factura.original}</pre>
        </details>
        <details className="rounded-xl border border-[#D9C4A7] bg-white p-3">
          <summary className="cursor-pointer text-sm font-bold">Corregir datos leídos de la factura</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label>Tipo<select className={campo} value={factura.tipo} onChange={e => modificar({ tipo: e.target.value })}><option value="33">Factura electrónica</option><option value="34">Factura exenta</option></select></label>
            {(['folio', 'rutEmisor', 'proveedor', 'rutReceptor', 'fecha'] as const).map(k => <label key={k}>{({ folio: 'Folio', rutEmisor: 'RUT proveedor', proveedor: 'Razón social proveedor', rutReceptor: 'RUT receptor', fecha: 'Fecha de emisión' })[k]}<input className={campo} type={k === 'fecha' ? 'date' : 'text'} value={factura[k]} onChange={e => modificar({ [k]: e.target.value })} /></label>)}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{(['neto', 'exento', 'iva', 'otros', 'total'] as const).map(k => <label key={k}>{({ neto: 'Neto afecto', exento: 'Exento', iva: 'IVA', otros: 'Otros (+/−)', total: 'Total factura' })[k]}<input type="number" step="any" className={campo} value={Number.isFinite(factura[k]) ? factura[k] : ''} onChange={e => modificar({ [k]: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>)}</div>
        </details>
        <h3 className="font-bold">Asociación de productos</h3>
        <p className="text-sm">Se asocia automáticamente por el código del proveedor. Si no existe una equivalencia, busca un producto o define el tipo para crearlo al cargar la factura.</p>
        {factura.lineas.map((l, i) => {
          const productoAsociado = productos[l.productoId];
          const tipoNuevo = tiposProductoNuevo[i];
          const unidadesPorCaja = Number(productoAsociado?.undxcaja || 0);
          return <div key={i} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(220px,1fr)_minmax(260px,1.4fr)]">
            <div>
              <p className="font-black text-[#2A1710]">{l.nombre || `Línea ${i + 1}`}</p>
              <p className="mt-1 text-xs text-[#5F4030]">{l.cantidad} {l.unidad || 'un.'} · Neto {pesos(l.montoNeto)} · Unitario {l.cantidad > 0 ? pesos(l.montoNeto / l.cantidad) : '—'}</p>
              <p className="mt-1 text-xs font-bold text-[#5F4030]">Código proveedor: {l.codigo || 'No detectado'}</p>
            </div>
            <div>
              <p className="text-sm font-bold">{productoAsociado ? `✓ ${productoAsociado.nombre}` : 'Buscar producto del catálogo'}</p>
              {asociadosPorCodigo[`${indice}:${i}`] && <p className="mt-1 text-xs font-bold text-emerald-700">Asociado automáticamente por código de proveedor.</p>}
              <Buscador tabla="productos" empresaId={empresa?.id || ''} onSelect={(p: ProductoFactura) => {
                setProductos(actual => ({ ...actual, [p.id]: p }));
                setTiposProductoNuevo(actual => { const siguiente = { ...actual }; delete siguiente[i]; return siguiente; });
                setComprasPorCaja(actual => { const siguiente = { ...actual }; delete siguiente[i]; return siguiente; });
                linea(i, { productoId: String(p.id) });
              }} />
              {productoAsociado && unidadesPorCaja > 1 && <label className="mt-3 block text-sm font-bold">La factura cobra
                <select className={campo} aria-label={`Presentación de compra para ${l.nombre || `línea ${i + 1}`}`} value={comprasPorCaja[i] ? 'caja' : 'unidad'} onChange={e => {
                  setComprasPorCaja(actual => ({ ...actual, [i]: e.target.value === 'caja' }));
                  setRevisado(false);
                }}>
                  <option value="unidad">Por unidad</option>
                  <option value="caja">Por caja de {unidadesPorCaja.toLocaleString('es-CL')} unidades</option>
                </select>
                <span className="mt-1 block text-xs font-normal text-[#5F4030]">Al elegir caja, el stock y costo se convierten automáticamente a unidades vendibles.</span>
              </label>}
              {!productoAsociado && <label className="mt-3 block text-sm font-bold">Tipo al crear
                <select className={campo} aria-label={`Tipo para ${l.nombre || `línea ${i + 1}`}`} value={tipoNuevo || ''} onChange={e => {
                  const tipo = e.target.value as TipoProductoFactura;
                  setTiposProductoNuevo(actual => tipo ? { ...actual, [i]: tipo } : Object.fromEntries(Object.entries(actual).filter(([clave]) => Number(clave) !== i)) as Record<number, TipoProductoFactura>);
                  setRevisado(false);
                }}>
                  <option value="">Selecciona el tipo…</option>
                  <option value="ingrediente">Materia prima</option>
                  <option value="envase">Insumo</option>
                  <option value="producto">Producto terminado</option>
                </select>
                <span className="mt-1 block text-xs font-normal text-[#5F4030]">Luego podrás asignar la familia y revisar el costo antes de registrarlo.</span>
              </label>}
            </div>
            <details className="md:col-span-2"><summary className="cursor-pointer text-xs font-bold text-[#5F4030]">Corregir esta línea</summary><div className="mt-2 grid gap-3 md:grid-cols-3">
              <label>Descripción<input className={campo} value={l.nombre} onChange={e => linea(i, { nombre: e.target.value })} /><span className="text-xs">Código proveedor: {l.codigo || '—'} · Unidad: {l.unidad || 'Sin indicar'}</span></label>
              <label>Código proveedor<input className={campo} value={l.codigo} onChange={e => linea(i, { codigo: e.target.value })} /></label>
              <label>Cantidad<input className={campo} type="number" min="0" step="any" value={l.cantidad} onChange={e => linea(i, { cantidad: Number(e.target.value) })} /></label>
              <label>Monto neto<input className={campo} type="number" min="0" step="any" value={Number(l.montoNeto.toFixed(4))} onChange={e => linea(i, { montoNeto: Number(e.target.value) })} /></label>
              <label><input type="checkbox" checked={l.exento} onChange={e => linea(i, { exento: e.target.checked })} /> Exento</label><button type="button" className="text-left text-red-800 underline" onClick={() => modificar({ lineas: factura.lineas.filter((_, n) => n !== i) })}>Quitar línea</button>
            </div></details>
          </div>;
        })}
        <button type="button" className="rounded-lg border px-4 py-2" onClick={() => modificar({ lineas: [...factura.lineas, { nombre: '', codigo: '', unidad: '', cantidad: 1, montoNeto: 0, exento: factura.tipo === '34', productoId: '' }] })}>+ Agregar línea</button>
        {problemas.length > 0 && <ul className="list-disc rounded-lg bg-amber-50 py-3 pl-8 text-sm">{problemas.map((p, i) => <li key={i}>{p}</li>)}</ul>}
        <label className="flex items-start gap-2 font-bold"><input type="checkbox" checked={revisado} onChange={e => setRevisado(e.target.checked)} /> Confirmo que la foto y los productos asociados están correctos.</label>
        <div className="flex flex-wrap gap-3"><button type="button" className={boton} disabled={!empresa || problemas.length > 0 || !revisado || aplicando || !!mensaje} onClick={() => void aplicar()}>{aplicando ? 'Cargando…' : 'Llevar a la factura'}</button><button type="button" className="rounded-lg border px-4 py-2" onClick={descargar}>Descargar revisión</button></div>
        {mensaje && <p role="status" className="rounded-lg bg-green-50 p-3">{mensaje}</p>}
      </fieldset>}
    </div>}
  </section>;
}
