'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAdminSession } from '@/components/AdminSession';
import { supabase } from '@/lib/supabase';
import { leerVentasFepan, type VentaFepan } from '@/lib/ventas-fepan';

type Importacion = { id: string; fecha_desde: string; fecha_hasta: string; detalle: VentaFepan[]; nombre_archivo: string; created_at: string };
const moneda = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;
const fecha = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('es-CL');

export default function VentasFepanPage() {
  const { perfil, esAdmin, cargando } = useAdminSession();
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [detalle, setDetalle] = useState<VentaFepan[]>([]);
  const [archivo, setArchivo] = useState('');
  const [historial, setHistorial] = useState<Importacion[]>([]);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function cargarHistorial() {
    if (!perfil?.empresa_id || !esAdmin) return;
    const { data, error: fallo } = await supabase.from('ventas_fepan_importaciones').select('id,fecha_desde,fecha_hasta,detalle,nombre_archivo,created_at').eq('empresa_id', perfil.empresa_id).order('created_at', { ascending: false });
    if (fallo) setError('No se pudo cargar el historial. Verifica que esté aplicada la instalación de ventas FEPAN.');
    else setHistorial((data || []) as Importacion[]);
  }
  useEffect(() => { void cargarHistorial(); }, [perfil?.empresa_id, esAdmin]);

  async function leerArchivo(file?: File) {
    setDetalle([]); setArchivo(''); setMensaje(''); setError('');
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('El archivo supera los 10 MB.'); return; }
    try {
      const ExcelJS = await import('exceljs');
      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(await file.arrayBuffer());
      const hoja = libro.worksheets[0];
      if (!hoja) throw new Error('El archivo no contiene hojas.');
      const filas: unknown[][] = [];
      hoja.eachRow((row) => { filas.push(Array.from({ length: 6 }, (_, index) => row.getCell(index + 1).value)); });
      setDetalle(leerVentasFepan(filas)); setArchivo(file.name);
    } catch (fallo) { setError(fallo instanceof Error ? fallo.message : 'No se pudo leer el archivo Excel.'); }
  }

  const resumen = useMemo(() => (['Pan', 'Cecinas', 'Pastelería'] as const).map((grupo) => ({ grupo, total: detalle.filter((d) => d.grupo === grupo).reduce((s, d) => s + d.total, 0), cantidad: detalle.filter((d) => d.grupo === grupo).reduce((s, d) => s + d.cantidad, 0) })), [detalle]);
  async function guardar() {
    if (!perfil?.empresa_id || !esAdmin || !detalle.length) return;
    if (!desde || !hasta || desde > hasta) { setError('Indica un período válido, igual al consultado en FEPAN.'); return; }
    setGuardando(true); setError(''); setMensaje('');
    const { data: cruces, error: falloConsulta } = await supabase.from('ventas_fepan_importaciones').select('id,fecha_desde,fecha_hasta').eq('empresa_id', perfil.empresa_id).lte('fecha_desde', hasta).gte('fecha_hasta', desde).limit(1);
    if (falloConsulta) { setError('No se pudo verificar el historial. Comprueba que esté aplicada la instalación de ventas FEPAN.'); setGuardando(false); return; }
    if (cruces?.length) { setError(`El período se cruza con una importación existente (${fecha(cruces[0].fecha_desde)} al ${fecha(cruces[0].fecha_hasta)}).`); setGuardando(false); return; }
    const { error: fallo } = await supabase.from('ventas_fepan_importaciones').insert({ empresa_id: perfil.empresa_id, fecha_desde: desde, fecha_hasta: hasta, detalle, nombre_archivo: archivo });
    if (fallo) setError(`No se pudo guardar la importación: ${fallo.message}`);
    else { setMensaje('Importación guardada.'); await cargarHistorial(); }
    setGuardando(false);
  }

  if (cargando) return <p>Cargando...</p>;
  if (!esAdmin) return <p className="rounded-lg bg-red-50 p-6 text-red-800">Este informe está disponible para administradores.</p>;
  return <div className="space-y-5 text-[#2A1710]">
    <header><h1 className="text-3xl font-black">Ventas FEPAN</h1><p className="mt-2 text-sm">Importa el Excel de Informes → Ventas de Productos y revisa los totales antes de guardar.</p></header>
    <section className="rounded-xl border border-[#E9D7BC] bg-white p-5 space-y-4">
      <p className="text-sm">El archivo no incluye fechas. Indica el mismo período que consultaste en FEPAN.</p>
      <div className="flex flex-wrap gap-4"><label className="font-bold">Desde<input className="block rounded border p-2" type="date" value={desde} onChange={e => setDesde(e.target.value)} /></label><label className="font-bold">Hasta<input className="block rounded border p-2" type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></label></div>
      <label className="block font-bold">Excel de FEPAN<input className="mt-2 block w-full text-sm" type="file" accept=".xlsx" onChange={e => void leerArchivo(e.target.files?.[0])} /></label>
      <p className="text-sm">Pan suma PAN, ESPECIAL, SUPER ESPECIAL, PAN FRIO y PAN MOLDE. PAN PASCUA no se suma.</p>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}{mensaje && <p role="status" className="rounded bg-emerald-50 p-3 text-emerald-800">{mensaje}</p>}
      {detalle.length > 0 && <><div className="grid gap-3 sm:grid-cols-3">{resumen.map(item => <div key={item.grupo} className="rounded-lg bg-[#FFF3DF] p-4"><h2 className="font-black">{item.grupo}</h2><p className="text-2xl font-black">{moneda(item.total)}</p><p className="text-sm">Cantidad informada: {item.cantidad.toLocaleString('es-CL')}</p></div>)}</div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th>Código</th><th>Descripción FEPAN</th><th>Grupo</th><th>Cantidad</th><th>Total</th></tr></thead><tbody>{detalle.map((item, i) => <tr key={`${item.codigo}-${i}`} className="border-b"><td>{item.codigo}</td><td>{item.descripcion}</td><td>{item.grupo}</td><td>{item.cantidad.toLocaleString('es-CL')}</td><td>{moneda(item.total)}</td></tr>)}</tbody></table></div><button type="button" disabled={guardando} onClick={() => void guardar()} className="rounded-lg bg-[#A51F2B] px-5 py-3 font-black text-white disabled:opacity-50">{guardando ? 'Guardando...' : 'Guardar importación'}</button></>}
    </section>
    <section className="rounded-xl border border-[#E9D7BC] bg-white p-5"><h2 className="text-xl font-black">Importaciones guardadas</h2>{historial.length === 0 ? <p className="mt-3 text-sm">Aún no hay importaciones.</p> : <div className="mt-3 space-y-2">{historial.map(item => <button key={item.id} type="button" className="block w-full rounded border p-3 text-left hover:bg-[#FFF3DF]" onClick={() => { setDesde(item.fecha_desde); setHasta(item.fecha_hasta); setDetalle(item.detalle); setArchivo(item.nombre_archivo); setError(''); setMensaje('Importación guardada: consulta sus valores abajo.'); }}>{fecha(item.fecha_desde)} al {fecha(item.fecha_hasta)} · {item.nombre_archivo}</button>)}</div>}</section>
  </div>;
}
