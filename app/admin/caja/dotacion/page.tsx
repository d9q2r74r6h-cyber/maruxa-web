'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';
import { supabase } from '@/lib/supabase';

type Funcionario = { id: string; nombre_completo: string; funcionario_cargos?: { cargos_empresa?: { nombre: string }[] | null }[] };
type Asignacion = { id: string; funcionario_id: string; nombre: string; origen: 'casa' | 'externo'; funcion: 'batea' | 'cocedor' | 'oficial' };
type Turno = { id: string; nombre: string; panaderos: Asignacion[] };
type Plantilla = { id: string; nombre: string; turnos: Turno[] };
type PlantillaDb = Partial<Plantilla> & { id: string; semana_desde?: string | null; dotacion?: Record<string, Turno[]> };
const nuevaAsignacion = (): Asignacion => ({ id: crypto.randomUUID(), funcionario_id: '', nombre: '', origen: 'casa', funcion: 'oficial' });
const nuevoTurno = (numero: number): Turno => ({ id: crypto.randomUUID(), nombre: `${numero}° turno`, panaderos: [nuevaAsignacion()] });
function normalizarPlantilla(item: PlantillaDb): Plantilla { const anteriores=item.dotacion ? Object.values(item.dotacion).find((turnos) => Array.isArray(turnos)&&turnos.length) : undefined; return { id:item.id, nombre:item.nombre || `DOTACIÓN ${item.semana_desde || ''}`.trim(), turnos:item.turnos?.length ? item.turnos : anteriores || [] }; }

export default function DotacionesPage() {
  const { perfil } = useAdminSession();
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [seleccionada, setSeleccionada] = useState('');
  const [nombre, setNombre] = useState('');
  const [turnos, setTurnos] = useState<Turno[]>([nuevoTurno(1), nuevoTurno(2)]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  async function cargar(preferida?: string) {
    if (!perfil) return;
    const [{ data: personas }, { data: datos }] = await Promise.all([
      supabase.from('funcionarios').select('id,nombre_completo,funcionario_cargos(cargos_empresa(nombre))').eq('empresa_id', perfil.empresa_id).eq('activo', true).order('nombre_completo'),
      supabase.from('caja_dotaciones_semanales').select('*').eq('empresa_id', perfil.empresa_id).order('created_at'),
    ]);
    const lista = ((datos || []) as PlantillaDb[]).map(normalizarPlantilla);
    setFuncionarios(((personas || []) as Funcionario[]).filter((persona) => (persona.funcionario_cargos || []).some((relacion) => relacion.cargos_empresa?.some((cargo) => cargo.nombre.toLocaleLowerCase('es').includes('panadero'))))); setPlantillas(lista); setCargando(false);
    const actual = lista.find((item) => item.id === (preferida || seleccionada));
    if (actual) { setSeleccionada(actual.id); setNombre(actual.nombre); setTurnos(actual.turnos?.length ? actual.turnos : [nuevoTurno(1)]); }
  }
  useEffect(() => { void cargar(); }, [perfil]);
  function nueva() { setSeleccionada(''); setNombre(''); setTurnos([nuevoTurno(1), nuevoTurno(2)]); }
  function elegir(id: string) { const item = plantillas.find((p) => p.id === id); if (!item) return nueva(); setSeleccionada(id); setNombre(item.nombre); setTurnos(item.turnos?.length ? item.turnos : [nuevoTurno(1)]); }
  async function guardar() {
    if (!perfil || !nombre.trim()) return alert('Escribe un nombre para la dotación.');
    setGuardando(true);
    const datos = { empresa_id: perfil.empresa_id, nombre: nombre.trim().toUpperCase(), turnos };
    const consulta = seleccionada ? supabase.from('caja_dotaciones_semanales').update(datos).eq('id', seleccionada).select('id').single() : supabase.from('caja_dotaciones_semanales').insert(datos).select('id').single();
    const { data, error } = await consulta; setGuardando(false); if (error) return alert(error.message); await cargar(data.id); alert('Dotación guardada.');
  }
  async function eliminar() { if (!seleccionada || !confirm('¿Eliminar esta dotación?')) return; const { error } = await supabase.from('caja_dotaciones_semanales').delete().eq('id', seleccionada); if (error) return alert(error.message); nueva(); await cargar(); }
  function actualizarTurno(id: string, cambio: Partial<Turno>) { setTurnos((lista) => lista.map((t) => t.id === id ? { ...t, ...cambio } : t)); }

  if (cargando) return <div className="grid min-h-64 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#A51F2B]" /></div>;
  return <div className="space-y-5 pb-12">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/admin/caja" className="inline-flex items-center gap-2 text-xs font-black uppercase text-[#A51F2B]"><ArrowLeft className="h-4 w-4" />Caja diaria</Link><h1 className="mt-2 text-3xl font-black text-[#2A1710]">Dotaciones de panaderos</h1><p className="mt-1 text-sm font-bold text-[#4B2818]/65">Crea plantillas por nombre, como “LUNES A JUEVES” o “VIERNES”.</p></div><div className="flex gap-2"><button onClick={nueva} className="h-11 rounded-md border border-[#A51F2B] px-4 text-sm font-black text-[#A51F2B]">Nueva dotación</button><button disabled={guardando} onClick={() => void guardar()} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#A51F2B] px-5 text-sm font-black text-white"><Save className="h-4 w-4" />Guardar</button></div></header>
    <section className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-[280px_1fr_auto]"><label className="grid gap-1 text-xs font-black uppercase text-[#4B2818]/60">Dotación existente<select value={seleccionada} onChange={(e) => elegir(e.target.value)} className="h-11 rounded-md border bg-white px-3 text-sm font-bold normal-case"><option value="">Nueva dotación</option>{plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label><label className="grid gap-1 text-xs font-black uppercase text-[#4B2818]/60">Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: LUNES A JUEVES" className="h-11 rounded-md border px-3 text-sm font-black uppercase normal-case" /></label>{seleccionada && <button onClick={() => void eliminar()} className="mt-auto grid h-11 w-11 place-items-center rounded-md text-red-700 hover:bg-red-50"><Trash2 className="h-5 w-5" /></button>}</section>
    <div className="grid gap-4 lg:grid-cols-2">{turnos.map((turno) => <section key={turno.id} className="rounded-xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><input value={turno.nombre} onChange={(e) => actualizarTurno(turno.id, { nombre: e.target.value })} className="h-10 rounded border px-3 font-black" />{turnos.length > 1 && <button onClick={() => setTurnos((lista) => lista.filter((t) => t.id !== turno.id))} className="p-2 text-red-700"><Trash2 className="h-4 w-4" /></button>}</div><div className="mt-3 space-y-2">{turno.panaderos.map((panadero, indice) => <div key={panadero.id} className="grid gap-2 sm:grid-cols-[1fr_100px_105px_36px]"><select value={panadero.funcionario_id} onChange={(e) => { const persona = funcionarios.find((f) => f.id === e.target.value); actualizarTurno(turno.id, { panaderos: turno.panaderos.map((p, i) => i === indice ? { ...p, funcionario_id: e.target.value, nombre: persona?.nombre_completo || '' } : p) }); }} className="h-10 min-w-0 rounded border bg-white px-2 text-sm font-bold"><option value="">Seleccionar</option>{funcionarios.map((f) => <option key={f.id} value={f.id}>{f.nombre_completo}</option>)}</select><select value={panadero.origen} onChange={(e) => actualizarTurno(turno.id, { panaderos: turno.panaderos.map((p, i) => i === indice ? { ...p, origen: e.target.value as Asignacion['origen'] } : p) })} className="h-10 rounded border bg-white px-2 text-xs font-black"><option value="casa">Casa</option><option value="externo">Externo</option></select><select value={panadero.funcion} onChange={(e) => actualizarTurno(turno.id, { panaderos: turno.panaderos.map((p, i) => i === indice ? { ...p, funcion: e.target.value as Asignacion['funcion'] } : p) })} className="h-10 rounded border bg-white px-2 text-xs font-black"><option value="batea">Batea</option><option value="cocedor">Cocedor</option><option value="oficial">Oficial</option></select><button onClick={() => actualizarTurno(turno.id, { panaderos: turno.panaderos.filter((_, i) => i !== indice) })} className="grid h-10 place-items-center text-red-700"><Trash2 className="h-4 w-4" /></button></div>)}</div><button onClick={() => actualizarTurno(turno.id, { panaderos: [...turno.panaderos, nuevaAsignacion()] })} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[#A51F2B]"><Plus className="h-4 w-4" />Agregar panadero</button></section>)}</div>
    <button onClick={() => setTurnos((lista) => [...lista, nuevoTurno(lista.length + 1)])} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#A51F2B]/35 bg-white text-sm font-black text-[#A51F2B]"><Plus className="h-4 w-4" />Agregar turno</button>
  </div>;
}
