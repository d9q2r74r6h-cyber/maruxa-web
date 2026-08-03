'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Save, Trash2, WalletCards } from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';
import { supabase } from '@/lib/supabase';

type Linea = { id: string; nombre: string; monto: number };
type Funcionario = { id: string; nombre_completo: string; cargo: string };
type Cierre = {
  id: string;
  fecha: string;
  cajera_id: string | null;
  cajera_nombre: string;
  panaderos_primer_turno: Linea[];
  panaderos_segundo_turno: Linea[];
  compras_gastos: Linea[];
  total_ventas: number;
  efectivo: number;
  tarjetas: number;
  observacion: string | null;
  estado: 'borrador' | 'cerrada';
};

const hoy = new Date().toISOString().slice(0, 10);
const nuevaLinea = (): Linea => ({ id: crypto.randomUUID(), nombre: '', monto: 0 });
const dinero = (valor: number) => `$${Math.round(valor || 0).toLocaleString('es-CL')}`;
const numero = (valor: unknown) => Number(String(valor ?? '').replace(/\./g, '').replace(',', '.')) || 0;

function EditorLineas({ titulo, lineas, onChange }: { titulo: string; lineas: Linea[]; onChange: (lineas: Linea[]) => void }) {
  const total = lineas.reduce((suma, linea) => suma + numero(linea.monto), 0);
  return (
    <section className="rounded-xl border border-[#4B2818]/15 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-black text-[#2A1710]">{titulo}</h2>
        <span className="rounded-full bg-[#FFF3DF] px-3 py-1 text-sm font-black text-[#A51F2B]">{dinero(total)}</span>
      </div>
      <div className="mt-3 space-y-2">
        {lineas.map((linea, indice) => (
          <div key={linea.id} className="grid grid-cols-[minmax(0,1fr)_130px_36px] gap-2">
            <input value={linea.nombre} onChange={(event) => onChange(lineas.map((item, posicion) => posicion === indice ? { ...item, nombre: event.target.value } : item))} placeholder={titulo.includes('Gastos') ? 'Detalle del gasto' : 'Nombre del panadero'} className="h-10 min-w-0 rounded-md border border-[#4B2818]/20 px-3 text-sm font-bold" />
            <input type="text" inputMode="numeric" value={linea.monto || ''} onChange={(event) => onChange(lineas.map((item, posicion) => posicion === indice ? { ...item, monto: Math.max(0, numero(event.target.value)) } : item))} placeholder="$0" className="h-10 rounded-md border border-[#4B2818]/20 px-3 text-right text-sm font-black" />
            <button type="button" aria-label="Eliminar fila" onClick={() => onChange(lineas.filter((_, posicion) => posicion !== indice))} className="grid h-10 place-items-center rounded-md text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...lineas, nuevaLinea()])} className="mt-3 inline-flex items-center gap-2 rounded-md border border-[#A51F2B]/30 px-3 py-2 text-xs font-black text-[#A51F2B]"><Plus className="h-4 w-4" />Agregar fila</button>
    </section>
  );
}

export default function CajaDiariaPage() {
  const { perfil } = useAdminSession();
  const [fecha, setFecha] = useState(hoy);
  const [cajeras, setCajeras] = useState<Funcionario[]>([]);
  const [cajeraId, setCajeraId] = useState('');
  const [primerTurno, setPrimerTurno] = useState<Linea[]>([nuevaLinea()]);
  const [segundoTurno, setSegundoTurno] = useState<Linea[]>([nuevaLinea()]);
  const [gastos, setGastos] = useState<Linea[]>([nuevaLinea()]);
  const [totalVentas, setTotalVentas] = useState(0);
  const [efectivo, setEfectivo] = useState(0);
  const [tarjetas, setTarjetas] = useState(0);
  const [observacion, setObservacion] = useState('');
  const [cierre, setCierre] = useState<Cierre | null>(null);
  const [historial, setHistorial] = useState<Cierre[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const totalPrimerTurno = primerTurno.reduce((suma, item) => suma + numero(item.monto), 0);
  const totalSegundoTurno = segundoTurno.reduce((suma, item) => suma + numero(item.monto), 0);
  const totalComprasGastos = gastos.reduce((suma, item) => suma + numero(item.monto), 0);
  const totalGastos = totalPrimerTurno + totalSegundoTurno + totalComprasGastos;
  const totalComprobado = efectivo + tarjetas + totalGastos;
  const diferencia = totalVentas - totalComprobado;
  const cuadrada = Math.abs(diferencia) < 0.5;
  const bloqueada = cierre?.estado === 'cerrada';

  async function cargarBase() {
    if (!perfil) return;
    const [{ data: funcionarios }, { data: cierres }] = await Promise.all([
      supabase.from('funcionarios').select('id,nombre_completo,cargo').eq('empresa_id', perfil.empresa_id).eq('activo', true).order('nombre_completo'),
      supabase.from('caja_cierres').select('*').eq('empresa_id', perfil.empresa_id).order('fecha', { ascending: false }).limit(31),
    ]);
    const lista = (funcionarios || []) as Funcionario[];
    setCajeras(lista);
    setHistorial((cierres || []) as Cierre[]);
    const predeterminada = perfil.funcionario_id || lista[0]?.id || '';
    setCajeraId((actual) => actual || predeterminada);
    setCargando(false);
  }

  function cargarCierre(item: Cierre | null) {
    setCierre(item);
    setPrimerTurno(item?.panaderos_primer_turno?.length ? item.panaderos_primer_turno : [nuevaLinea()]);
    setSegundoTurno(item?.panaderos_segundo_turno?.length ? item.panaderos_segundo_turno : [nuevaLinea()]);
    setGastos(item?.compras_gastos?.length ? item.compras_gastos : [nuevaLinea()]);
    setCajeraId(item?.cajera_id || perfil?.funcionario_id || '');
    setTotalVentas(numero(item?.total_ventas));
    setEfectivo(numero(item?.efectivo));
    setTarjetas(numero(item?.tarjetas));
    setObservacion(item?.observacion || '');
  }

  useEffect(() => { void cargarBase(); }, [perfil]);
  useEffect(() => {
    if (cargando) return;
    cargarCierre(historial.find((item) => item.fecha === fecha) || null);
  }, [fecha, cargando, historial]);

  async function guardar(estado: 'borrador' | 'cerrada') {
    if (!perfil || !cajeraId) return alert('Selecciona la cajera responsable.');
    if (estado === 'cerrada' && !cuadrada && !observacion.trim()) return alert('Explica la diferencia antes de cerrar la caja.');
    if (estado === 'cerrada' && !confirm(cuadrada ? '¿Cerrar y bloquear la caja del día?' : 'La caja tiene diferencia. ¿Cerrar igualmente con la observación ingresada?')) return;
    const cajera = cajeras.find((item) => item.id === cajeraId);
    setGuardando(true);
    const datos = {
      empresa_id: perfil.empresa_id,
      fecha,
      cajera_id: cajeraId,
      cajera_nombre: cajera?.nombre_completo || perfil.nombre_visible,
      panaderos_primer_turno: primerTurno.filter((item) => item.nombre.trim() || item.monto),
      panaderos_segundo_turno: segundoTurno.filter((item) => item.nombre.trim() || item.monto),
      compras_gastos: gastos.filter((item) => item.nombre.trim() || item.monto),
      total_ventas: totalVentas,
      efectivo,
      tarjetas,
      observacion: observacion.trim() || null,
      estado,
      cerrado_en: estado === 'cerrada' ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from('caja_cierres').upsert(datos, { onConflict: 'empresa_id,fecha' });
    setGuardando(false);
    if (error) return alert(error.message);
    await cargarBase();
    alert(estado === 'cerrada' ? 'Caja cerrada.' : 'Borrador guardado.');
  }

  if (cargando) return <div className="grid min-h-64 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#A51F2B]" /></div>;

  return (
    <div className="space-y-5 pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-black uppercase tracking-widest text-[#A51F2B]">Comercial</p><h1 className="mt-1 text-3xl font-black text-[#2A1710]">Caja diaria</h1><p className="mt-2 text-sm font-bold text-[#4B2818]/65">Cuadre manual de ventas, pagos a panaderos y gastos del día.</p></div>
        <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black ${cuadrada ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{cuadrada ? <CheckCircle2 className="h-4 w-4" /> : <WalletCards className="h-4 w-4" />}{cuadrada ? 'Caja cuadrada' : `Diferencia ${dinero(diferencia)}`}</div>
      </header>

      <section className="grid gap-3 rounded-xl border border-[#4B2818]/15 bg-white p-4 shadow-sm md:grid-cols-2">
        <label className="grid gap-1 text-xs font-black uppercase text-[#4B2818]/60">Fecha<input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} className="h-11 rounded-md border px-3 text-sm font-bold normal-case" /></label>
        <label className="grid gap-1 text-xs font-black uppercase text-[#4B2818]/60">Cajera responsable<select value={cajeraId} disabled={bloqueada} onChange={(event) => setCajeraId(event.target.value)} className="h-11 rounded-md border bg-white px-3 text-sm font-bold normal-case disabled:bg-stone-100"><option value="">Seleccionar</option>{cajeras.map((item) => <option key={item.id} value={item.id}>{item.nombre_completo}</option>)}</select></label>
      </section>

      <fieldset disabled={bloqueada} className="space-y-5 disabled:opacity-75">
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-5"><EditorLineas titulo="Panaderos · 1er turno" lineas={primerTurno} onChange={setPrimerTurno} /><EditorLineas titulo="Panaderos · 2do turno" lineas={segundoTurno} onChange={setSegundoTurno} /></div>
          <EditorLineas titulo="Compras y Gastos" lineas={gastos} onChange={setGastos} />
        </div>

        <section className="overflow-hidden rounded-xl border border-[#4B2818]/15 bg-white shadow-sm">
          <div className="border-b border-[#4B2818]/10 bg-[#2A1710] px-5 py-4 text-white"><h2 className="text-lg font-black">Cuadre del día</h2><p className="text-xs font-bold text-white/65">Efectivo + Tarjetas + Panaderos + Compras/Gastos</p></div>
          <div className="grid gap-4 p-5 lg:grid-cols-3">
            {[['Total ventas', totalVentas, setTotalVentas], ['Efectivo', efectivo, setEfectivo], ['Tarjetas', tarjetas, setTarjetas]].map(([etiqueta, valor, setter]) => <label key={String(etiqueta)} className="grid gap-1 text-xs font-black uppercase text-[#4B2818]/60">{String(etiqueta)}<input type="text" inputMode="numeric" value={Number(valor) || ''} onChange={(event) => (setter as (valor: number) => void)(Math.max(0, numero(event.target.value)))} className="h-14 rounded-lg border-2 border-[#D9C4A7] px-4 text-right text-xl font-black text-[#2A1710] outline-none focus:border-[#A51F2B]" /></label>)}
          </div>
          <div className="grid gap-3 border-t border-[#4B2818]/10 bg-[#FFF9EF] p-5 sm:grid-cols-2 lg:grid-cols-5">
            <div><p className="text-[10px] font-black uppercase text-[#4B2818]/55">1er turno</p><p className="text-lg font-black">{dinero(totalPrimerTurno)}</p></div>
            <div><p className="text-[10px] font-black uppercase text-[#4B2818]/55">2do turno</p><p className="text-lg font-black">{dinero(totalSegundoTurno)}</p></div>
            <div><p className="text-[10px] font-black uppercase text-[#4B2818]/55">Compras/Gastos</p><p className="text-lg font-black">{dinero(totalComprasGastos)}</p></div>
            <div><p className="text-[10px] font-black uppercase text-[#4B2818]/55">Total comprobado</p><p className="text-lg font-black">{dinero(totalComprobado)}</p></div>
            <div className={`rounded-lg px-4 py-3 ${cuadrada ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}><p className="text-[10px] font-black uppercase">Diferencia</p><p className="text-xl font-black">{dinero(diferencia)}</p></div>
          </div>
        </section>

        <label className="grid gap-1 text-xs font-black uppercase text-[#4B2818]/60">Observación<textarea value={observacion} onChange={(event) => setObservacion(event.target.value)} placeholder={cuadrada ? 'Opcional' : 'Obligatoria si existe diferencia'} className="min-h-24 rounded-lg border border-[#4B2818]/20 p-3 text-sm font-bold normal-case" /></label>
      </fieldset>

      <div className="flex flex-wrap justify-end gap-3">
        {!bloqueada && <><button type="button" disabled={guardando} onClick={() => void guardar('borrador')} className="inline-flex h-11 items-center gap-2 rounded-md border border-[#A51F2B] bg-white px-5 text-sm font-black text-[#A51F2B]"><Save className="h-4 w-4" />Guardar borrador</button><button type="button" disabled={guardando} onClick={() => void guardar('cerrada')} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#A51F2B] px-6 text-sm font-black text-white"><CheckCircle2 className="h-4 w-4" />Cerrar caja</button></>}
        {bloqueada && <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-800">Cierre bloqueado</span>}
      </div>

      <section className="rounded-xl border border-[#4B2818]/15 bg-white p-4 shadow-sm"><h2 className="font-black text-[#2A1710]">Últimos cierres</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="bg-[#FFF3DF]"><tr><th className="px-3 py-2 text-left">Fecha</th><th className="px-3 py-2 text-left">Cajera</th><th className="px-3 py-2 text-right">Ventas</th><th className="px-3 py-2 text-right">Estado</th></tr></thead><tbody>{historial.map((item) => <tr key={item.id} className="cursor-pointer border-b hover:bg-[#FFF9EF]" onClick={() => setFecha(item.fecha)}><td className="px-3 py-2 font-black">{new Date(`${item.fecha}T12:00:00`).toLocaleDateString('es-CL')}</td><td className="px-3 py-2">{item.cajera_nombre}</td><td className="px-3 py-2 text-right font-black">{dinero(item.total_ventas)}</td><td className="px-3 py-2 text-right"><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${item.estado === 'cerrada' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{item.estado}</span></td></tr>)}</tbody></table></div></section>
    </div>
  );
}
