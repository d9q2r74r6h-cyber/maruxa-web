'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';
import { supabase } from '@/lib/supabase';

type Funcionario = { id: string; nombre_completo: string; cargo: string };
type Asignacion = { id: string; funcionario_id: string; nombre: string; origen: 'casa' | 'externo'; funcion: 'batea' | 'cocedor' | 'oficial' };
type TurnoPlan = { id: string; nombre: string; panaderos: Asignacion[] };
type Dotacion = Record<string, TurnoPlan[]>;

const nuevaAsignacion = (): Asignacion => ({ id: crypto.randomUUID(), funcionario_id: '', nombre: '', origen: 'casa', funcion: 'oficial' });
const nuevoTurno = (numero: number): TurnoPlan => ({ id: crypto.randomUUID(), nombre: `${numero}° turno`, panaderos: [nuevaAsignacion()] });
const fechaIso = (fecha: Date) => fecha.toISOString().slice(0, 10);
function lunesDe(fecha: Date) { const copia = new Date(fecha); copia.setHours(12, 0, 0, 0); const dia = copia.getDay() || 7; copia.setDate(copia.getDate() - dia + 1); return copia; }
function diasSemana(lunes: string) { const inicio = new Date(`${lunes}T12:00:00`); return Array.from({ length: 7 }, (_, indice) => { const fecha = new Date(inicio); fecha.setDate(inicio.getDate() + indice); return fechaIso(fecha); }); }
const nombreDia = (fecha: string) => new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(`${fecha}T12:00:00`));

export default function DotacionSemanalPage() {
  const { perfil } = useAdminSession();
  const [semana, setSemana] = useState(fechaIso(lunesDe(new Date())));
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [dotacion, setDotacion] = useState<Dotacion>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const dias = diasSemana(semana);

  async function cargar() {
    if (!perfil) return;
    setCargando(true);
    const [{ data: personas }, { data: plan }] = await Promise.all([
      supabase.from('funcionarios').select('id,nombre_completo,cargo').eq('empresa_id', perfil.empresa_id).eq('activo', true).order('nombre_completo'),
      supabase.from('caja_dotaciones_semanales').select('dotacion').eq('empresa_id', perfil.empresa_id).eq('semana_desde', semana).maybeSingle(),
    ]);
    setFuncionarios((personas || []) as Funcionario[]);
    const guardada = (plan?.dotacion || {}) as Dotacion;
    setDotacion(Object.fromEntries(dias.map((dia) => [dia, guardada[dia]?.length ? guardada[dia] : [nuevoTurno(1), nuevoTurno(2)]])));
    setCargando(false);
  }
  useEffect(() => { void cargar(); }, [perfil, semana]);

  function cambiarTurnos(dia: string, turnos: TurnoPlan[]) { setDotacion((actual) => ({ ...actual, [dia]: turnos })); }
  async function copiarAnterior() {
    if (!perfil) return;
    const anterior = new Date(`${semana}T12:00:00`); anterior.setDate(anterior.getDate() - 7);
    const { data } = await supabase.from('caja_dotaciones_semanales').select('dotacion').eq('empresa_id', perfil.empresa_id).eq('semana_desde', fechaIso(anterior)).maybeSingle();
    if (!data?.dotacion) return alert('No existe una dotación guardada para la semana anterior.');
    const origen = Object.values(data.dotacion as Dotacion);
    setDotacion(Object.fromEntries(dias.map((dia, indice) => [dia, origen[indice] || [nuevoTurno(1)]])));
  }
  async function guardar() {
    if (!perfil) return;
    setGuardando(true);
    const { error } = await supabase.from('caja_dotaciones_semanales').upsert({ empresa_id: perfil.empresa_id, semana_desde: semana, dotacion }, { onConflict: 'empresa_id,semana_desde' });
    setGuardando(false);
    if (error) return alert(error.message);
    alert('Dotación semanal guardada.');
  }

  return <div className="space-y-5 pb-12">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/admin/caja" className="inline-flex items-center gap-2 text-xs font-black uppercase text-[#A51F2B]"><ArrowLeft className="h-4 w-4" />Caja diaria</Link><h1 className="mt-2 text-3xl font-black text-[#2A1710]">Dotación semanal</h1><p className="mt-1 text-sm font-bold text-[#4B2818]/65">Planifica los turnos. Los cambios hechos en Caja diaria no modifican esta plantilla.</p></div><div className="flex gap-2"><button type="button" onClick={() => void copiarAnterior()} className="inline-flex h-11 items-center gap-2 rounded-md border border-[#A51F2B] bg-white px-4 text-sm font-black text-[#A51F2B]"><Copy className="h-4 w-4" />Copiar anterior</button><button type="button" disabled={guardando} onClick={() => void guardar()} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#A51F2B] px-5 text-sm font-black text-white"><Save className="h-4 w-4" />Guardar semana</button></div></header>
    <label className="grid max-w-xs gap-1 text-xs font-black uppercase text-[#4B2818]/60">Semana desde<input type="date" value={semana} onChange={(event) => setSemana(fechaIso(lunesDe(new Date(`${event.target.value}T12:00:00`))))} className="h-11 rounded-md border bg-white px-3 text-sm font-bold normal-case" /></label>
    {cargando ? <div className="grid min-h-64 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#A51F2B]" /></div> : <div className="space-y-5">{dias.map((dia) => <section key={dia} className="rounded-xl border border-[#4B2818]/15 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="capitalize font-black text-[#2A1710]">{nombreDia(dia)}</h2><button type="button" onClick={() => cambiarTurnos(dia, [...dotacion[dia], nuevoTurno(dotacion[dia].length + 1)])} className="inline-flex items-center gap-1 text-xs font-black text-[#A51F2B]"><Plus className="h-4 w-4" />Agregar turno</button></div><div className="mt-3 grid gap-3 lg:grid-cols-2">{dotacion[dia].map((turno, indiceTurno) => <div key={turno.id} className="rounded-lg border border-[#E9D7BC] bg-[#FFF9EF] p-3"><div className="flex items-center justify-between"><input value={turno.nombre} onChange={(event) => cambiarTurnos(dia, dotacion[dia].map((item) => item.id === turno.id ? { ...item, nombre: event.target.value } : item))} className="h-9 min-w-0 max-w-40 rounded border bg-white px-2 font-black" />{dotacion[dia].length > 1 && <button type="button" onClick={() => cambiarTurnos(dia, dotacion[dia].filter((item) => item.id !== turno.id))} className="p-2 text-red-700"><Trash2 className="h-4 w-4" /></button>}</div><div className="mt-2 space-y-2">{turno.panaderos.map((panadero, indice) => <div key={panadero.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_110px_36px]"><select value={panadero.funcionario_id} onChange={(event) => { const persona = funcionarios.find((item) => item.id === event.target.value); cambiarTurnos(dia, dotacion[dia].map((item) => item.id === turno.id ? { ...item, panaderos: item.panaderos.map((asignado, posicion) => posicion === indice ? { ...asignado, funcionario_id: event.target.value, nombre: persona?.nombre_completo || '' } : asignado) } : item)); }} className="h-10 min-w-0 rounded border bg-white px-2 text-sm font-bold"><option value="">Seleccionar panadero</option>{funcionarios.map((item) => <option key={item.id} value={item.id}>{item.nombre_completo}</option>)}</select><select value={panadero.origen} onChange={(event) => cambiarTurnos(dia, dotacion[dia].map((item) => item.id === turno.id ? { ...item, panaderos: item.panaderos.map((asignado, posicion) => posicion === indice ? { ...asignado, origen: event.target.value as Asignacion['origen'] } : asignado) } : item))} className="h-10 rounded border bg-white px-2 text-xs font-black"><option value="casa">Casa</option><option value="externo">Externo</option></select><select value={panadero.funcion} onChange={(event) => cambiarTurnos(dia, dotacion[dia].map((item) => item.id === turno.id ? { ...item, panaderos: item.panaderos.map((asignado, posicion) => posicion === indice ? { ...asignado, funcion: event.target.value as Asignacion['funcion'] } : asignado) } : item))} className="h-10 rounded border bg-white px-2 text-xs font-black"><option value="batea">Batea</option><option value="cocedor">Cocedor</option><option value="oficial">Oficial</option></select><button type="button" onClick={() => cambiarTurnos(dia, dotacion[dia].map((item) => item.id === turno.id ? { ...item, panaderos: item.panaderos.filter((_, posicion) => posicion !== indice) } : item))} className="grid h-10 place-items-center text-red-700"><Trash2 className="h-4 w-4" /></button></div>)}</div><button type="button" onClick={() => cambiarTurnos(dia, dotacion[dia].map((item) => item.id === turno.id ? { ...item, panaderos: [...item.panaderos, nuevaAsignacion()] } : item))} className="mt-2 inline-flex items-center gap-1 text-xs font-black text-[#A51F2B]"><Plus className="h-4 w-4" />Panadero</button></div>)}</div></section>)}</div>}
  </div>;
}
