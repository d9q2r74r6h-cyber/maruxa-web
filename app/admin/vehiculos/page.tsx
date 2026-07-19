'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, Car, Plus, Save, Trash2, Wrench } from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';
import { supabase } from '@/lib/supabase';

type Vehiculo = {
  id: string; codigo: string; nombre: string; patente: string | null;
  repartidor_id: string | null; marca: string | null; modelo: string | null;
  anio: number | null; tipo: string | null; color: string | null;
  kilometraje_actual: number; estado: string; revision_tecnica_vence: string | null;
  permiso_circulacion_vence: string | null; seguro_vence: string | null;
  observacion: string | null; activo: boolean;
};
type Repartidor = { id: string; nombre_completo: string };
type Politica = { id: string; codigo: string; nombre: string; dias_anticipacion: number; km_anticipacion: number; activo: boolean };
type Registro = {
  id: string; vehiculo_id: string; politica_id: string | null; tipo: string;
  titulo: string; fecha: string; kilometraje: number | null; costo: number;
  detalle: string | null; proxima_fecha: string | null; proximo_kilometraje: number | null;
};
type Alerta = { clave: string; texto: string; nivel: 'vencida' | 'proxima' };

const vacio = {
  nombre: '', patente: '', repartidor_id: '', marca: '', modelo: '', anio: '',
  tipo: '', color: '', kilometraje_actual: '', estado: 'activo',
  revision_tecnica_vence: '', permiso_circulacion_vence: '', seguro_vence: '', observacion: '',
};
const registroVacio = {
  politica_id: '', tipo: 'mantencion', titulo: '', fecha: new Date().toISOString().slice(0, 10),
  kilometraje: '', costo: '', detalle: '', proxima_fecha: '', proximo_kilometraje: '',
};

function numero(valor: string | number | null | undefined) {
  return Number(String(valor ?? 0).replace(',', '.')) || 0;
}
function dinero(valor: number) { return `$${Math.round(valor || 0).toLocaleString('es-CL')}`; }
function fecha(valor: string | null) { return valor ? new Date(`${valor}T12:00:00`).toLocaleDateString('es-CL') : '—'; }
function diasHasta(valor: string) {
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
  return Math.ceil((new Date(`${valor}T12:00:00`).getTime() - hoy.getTime()) / 86400000);
}

export default function VehiculosPage() {
  const { perfil } = useAdminSession();
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [repartidores, setRepartidores] = useState<Repartidor[]>([]);
  const [politicas, setPoliticas] = useState<Politica[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [seleccionado, setSeleccionado] = useState('');
  const [form, setForm] = useState(vacio);
  const [nuevo, setNuevo] = useState(false);
  const [formRegistro, setFormRegistro] = useState(registroVacio);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorModulo, setErrorModulo] = useState('');

  async function cargar() {
    if (!perfil) return;
    setCargando(true); setErrorModulo('');
    const [v, f, p, r] = await Promise.all([
      supabase.from('vehiculos_reparto').select('*').eq('empresa_id', perfil.empresa_id).order('nombre'),
      supabase.from('funcionarios').select('id,nombre_completo,cargo').eq('empresa_id', perfil.empresa_id).eq('activo', true).order('nombre_completo'),
      supabase.from('vehiculo_alerta_politicas').select('id,codigo,nombre,dias_anticipacion,km_anticipacion,activo').eq('empresa_id', perfil.empresa_id).eq('activo', true).order('nombre'),
      supabase.from('vehiculo_registros').select('id,vehiculo_id,politica_id,tipo,titulo,fecha,kilometraje,costo,detalle,proxima_fecha,proximo_kilometraje').eq('empresa_id', perfil.empresa_id).order('fecha', { ascending: false }),
    ]);
    if (v.error || p.error || r.error) {
      setErrorModulo(v.error?.message || p.error?.message || r.error?.message || 'No se pudo cargar el módulo.');
      setCargando(false); return;
    }
    setVehiculos((v.data as Vehiculo[]) || []);
    setRepartidores(((f.data || []) as Array<Repartidor & { cargo: string }>).filter((item) => item.cargo.toLowerCase() === 'repartidor'));
    setPoliticas((p.data as Politica[]) || []);
    setRegistros((r.data as Registro[]) || []);
    setCargando(false);
  }
  useEffect(() => { void cargar(); }, [perfil]);

  function alertasVehiculo(vehiculo: Vehiculo) {
    const alertas: Alerta[] = [];
    const documentos = [
      ['revision_tecnica', 'Revisión técnica', vehiculo.revision_tecnica_vence],
      ['permiso_circulacion', 'Permiso de circulación', vehiculo.permiso_circulacion_vence],
      ['seguro', 'Seguro obligatorio', vehiculo.seguro_vence],
    ] as const;
    documentos.forEach(([codigo, nombre, vencimiento]) => {
      if (!vencimiento) return;
      const dias = diasHasta(vencimiento);
      const politica = politicas.find((item) => item.codigo === codigo);
      if (dias < 0) alertas.push({ clave: codigo, texto: `${nombre} vencida`, nivel: 'vencida' });
      else if (dias <= (politica?.dias_anticipacion ?? 30)) alertas.push({ clave: codigo, texto: `${nombre} vence en ${dias} días`, nivel: 'proxima' });
    });
    registros.filter((item) => item.vehiculo_id === vehiculo.id).forEach((item) => {
      const politica = politicas.find((p) => p.id === item.politica_id);
      if (item.proxima_fecha) {
        const dias = diasHasta(item.proxima_fecha);
        if (dias < 0) alertas.push({ clave: `${item.id}-f`, texto: `${item.titulo}: fecha vencida`, nivel: 'vencida' });
        else if (dias <= (politica?.dias_anticipacion ?? 30)) alertas.push({ clave: `${item.id}-f`, texto: `${item.titulo} en ${dias} días`, nivel: 'proxima' });
      }
      if (item.proximo_kilometraje) {
        const faltan = numero(item.proximo_kilometraje) - numero(vehiculo.kilometraje_actual);
        if (faltan <= 0) alertas.push({ clave: `${item.id}-k`, texto: `${item.titulo}: kilometraje alcanzado`, nivel: 'vencida' });
        else if (faltan <= (politica?.km_anticipacion ?? 500)) alertas.push({ clave: `${item.id}-k`, texto: `${item.titulo} en ${faltan.toLocaleString('es-CL')} km`, nivel: 'proxima' });
      }
    });
    return alertas;
  }

  const vehiculoActual = vehiculos.find((item) => item.id === seleccionado) || null;
  const registrosActuales = useMemo(() => registros.filter((item) => item.vehiculo_id === seleccionado), [registros, seleccionado]);

  function editar(vehiculo: Vehiculo) {
    setNuevo(false); setSeleccionado(vehiculo.id);
    setForm({
      nombre: vehiculo.nombre, patente: vehiculo.patente || '', repartidor_id: vehiculo.repartidor_id || '',
      marca: vehiculo.marca || '', modelo: vehiculo.modelo || '', anio: vehiculo.anio ? String(vehiculo.anio) : '',
      tipo: vehiculo.tipo || '', color: vehiculo.color || '', kilometraje_actual: String(vehiculo.kilometraje_actual || ''),
      estado: vehiculo.estado, revision_tecnica_vence: vehiculo.revision_tecnica_vence || '',
      permiso_circulacion_vence: vehiculo.permiso_circulacion_vence || '', seguro_vence: vehiculo.seguro_vence || '',
      observacion: vehiculo.observacion || '',
    });
  }
  function iniciarNuevo() { setNuevo(true); setSeleccionado(''); setForm(vacio); }

  async function guardarVehiculo() {
    if (!perfil || !form.nombre.trim()) return alert('Ingresa el nombre del vehículo.');
    setGuardando(true);
    const datos = {
      empresa_id: perfil.empresa_id, nombre: form.nombre.trim(), patente: form.patente.trim().toUpperCase() || null,
      repartidor_id: form.repartidor_id || null, marca: form.marca.trim() || null, modelo: form.modelo.trim() || null,
      anio: form.anio ? Number(form.anio) : null, tipo: form.tipo.trim() || null, color: form.color.trim() || null,
      kilometraje_actual: numero(form.kilometraje_actual), estado: form.estado,
      revision_tecnica_vence: form.revision_tecnica_vence || null, permiso_circulacion_vence: form.permiso_circulacion_vence || null,
      seguro_vence: form.seguro_vence || null, observacion: form.observacion.trim() || null,
    };
    let error;
    if (nuevo) {
      const codigo = (form.patente || form.nombre).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase();
      ({ error } = await supabase.from('vehiculos_reparto').insert({ ...datos, codigo }));
    } else if (seleccionado) ({ error } = await supabase.from('vehiculos_reparto').update(datos).eq('id', seleccionado));
    setGuardando(false);
    if (error) return alert(error.code === '23505' ? 'La patente o el repartidor ya están asignados.' : error.message);
    await cargar(); setNuevo(false); setSeleccionado(''); setForm(vacio);
  }

  async function guardarRegistro() {
    if (!perfil || !seleccionado || !formRegistro.titulo.trim()) return alert('Ingresa el nombre del registro.');
    setGuardando(true);
    const { error } = await supabase.from('vehiculo_registros').insert({
      empresa_id: perfil.empresa_id, vehiculo_id: seleccionado, politica_id: formRegistro.politica_id || null,
      tipo: formRegistro.tipo, titulo: formRegistro.titulo.trim(), fecha: formRegistro.fecha,
      kilometraje: formRegistro.kilometraje ? numero(formRegistro.kilometraje) : null,
      costo: numero(formRegistro.costo), detalle: formRegistro.detalle.trim() || null,
      proxima_fecha: formRegistro.proxima_fecha || null,
      proximo_kilometraje: formRegistro.proximo_kilometraje ? numero(formRegistro.proximo_kilometraje) : null,
    });
    setGuardando(false); if (error) return alert(error.message);
    setFormRegistro(registroVacio); await cargar();
  }

  async function eliminarRegistro(id: string) {
    if (!confirm('¿Eliminar este registro del vehículo?')) return;
    const { error } = await supabase.from('vehiculo_registros').delete().eq('id', id);
    if (error) return alert(error.message); await cargar();
  }

  return <div className="space-y-6 pb-12">
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><p className="text-xs font-black uppercase tracking-widest text-red-700">Inventario</p><h1 className="mt-1 text-3xl font-black text-maruxa-chocolate">Vehículos</h1><p className="mt-2 text-sm font-bold text-maruxa-cafe/65">Fichas, documentos, mantenciones y alertas de la flota.</p></div>
      <button type="button" onClick={iniciarNuevo} className="rounded-full bg-red-700 px-5 py-3 text-sm font-black text-white shadow-lg"><Plus className="mr-2 inline h-4 w-4" />Nuevo vehículo</button>
    </header>
    {errorModulo && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-800">{errorModulo}</div>}
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {vehiculos.map((vehiculo) => { const alertas = alertasVehiculo(vehiculo); const repartidor = repartidores.find((r) => r.id === vehiculo.repartidor_id); return <button type="button" key={vehiculo.id} onClick={() => editar(vehiculo)} className={`rounded-2xl border-2 bg-white p-4 text-left shadow-sm transition hover:border-red-300 ${seleccionado === vehiculo.id ? 'border-red-700' : 'border-transparent'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-black text-maruxa-chocolate">{vehiculo.nombre}</p><p className="text-xs font-bold text-maruxa-cafe/55">{vehiculo.patente || 'Sin patente'} · {repartidor?.nombre_completo || 'Sin repartidor'}</p></div><Car className="h-6 w-6 text-red-700" /></div><div className="mt-3 flex items-center justify-between text-xs font-bold"><span>{numero(vehiculo.kilometraje_actual).toLocaleString('es-CL')} km</span><span className={alertas.length ? 'text-red-700' : 'text-emerald-700'}>{alertas.length ? `${alertas.length} alerta(s)` : 'Sin alertas'}</span></div></button>; })}
    </section>
    {cargando && <p className="py-10 text-center font-bold">Cargando...</p>}
    {(nuevo || vehiculoActual) && <section className="rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black text-maruxa-chocolate">{nuevo ? 'Nuevo vehículo' : `Ficha · ${vehiculoActual?.nombre}`}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[['nombre','Nombre'],['patente','Patente'],['marca','Marca'],['modelo','Modelo'],['anio','Año'],['tipo','Tipo'],['color','Color'],['kilometraje_actual','Kilometraje actual']].map(([campo, etiqueta]) => <label key={campo} className="grid gap-1 text-xs font-black uppercase text-maruxa-cafe/60">{etiqueta}<input value={form[campo as keyof typeof form]} onChange={(e) => setForm({ ...form, [campo]: e.target.value })} className="h-11 rounded-xl border px-3 text-sm font-bold normal-case" /></label>)}
        <label className="grid gap-1 text-xs font-black uppercase text-maruxa-cafe/60">Repartidor<select value={form.repartidor_id} onChange={(e) => setForm({ ...form, repartidor_id: e.target.value })} className="h-11 rounded-xl border bg-white px-3 text-sm font-bold normal-case"><option value="">Sin asignar</option>{repartidores.map((r) => <option key={r.id} value={r.id}>{r.nombre_completo}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-black uppercase text-maruxa-cafe/60">Estado<select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className="h-11 rounded-xl border bg-white px-3 text-sm font-bold normal-case"><option value="activo">Activo</option><option value="taller">En taller</option><option value="fuera_servicio">Fuera de servicio</option></select></label>
        {[['revision_tecnica_vence','Revisión técnica'],['permiso_circulacion_vence','Permiso circulación'],['seguro_vence','Seguro obligatorio']].map(([campo, etiqueta]) => <label key={campo} className="grid gap-1 text-xs font-black uppercase text-maruxa-cafe/60">{etiqueta}<input type="date" value={form[campo as keyof typeof form]} onChange={(e) => setForm({ ...form, [campo]: e.target.value })} className="h-11 rounded-xl border px-3 text-sm font-bold normal-case" /></label>)}
        <label className="grid gap-1 text-xs font-black uppercase text-maruxa-cafe/60 md:col-span-2">Observación<input value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })} className="h-11 rounded-xl border px-3 text-sm font-bold normal-case" /></label>
      </div><div className="mt-4 flex justify-end"><button type="button" disabled={guardando} onClick={guardarVehiculo} className="rounded-xl bg-red-700 px-6 py-3 font-black text-white disabled:opacity-50"><Save className="mr-2 inline h-4 w-4" />Guardar ficha</button></div>
    </section>}
    {vehiculoActual && <>
      <section className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-black text-maruxa-chocolate"><Bell className="h-5 w-5 text-red-700" />Alertas activas</h2><div className="mt-4 grid gap-2 md:grid-cols-2">{alertasVehiculo(vehiculoActual).map((a) => <div key={a.clave} className={`rounded-xl border p-3 text-sm font-black ${a.nivel === 'vencida' ? 'border-red-300 bg-red-50 text-red-800' : 'border-amber-300 bg-amber-50 text-amber-900'}`}><AlertTriangle className="mr-2 inline h-4 w-4" />{a.texto}</div>)}{alertasVehiculo(vehiculoActual).length === 0 && <p className="text-sm font-bold text-emerald-700">Sin alertas pendientes.</p>}</div></section>
      <section className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-black text-maruxa-chocolate"><Wrench className="h-5 w-5 text-red-700" />Nuevo registro</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1 text-xs font-black uppercase">Tipo<select value={formRegistro.tipo} onChange={(e) => setFormRegistro({ ...formRegistro, tipo: e.target.value })} className="h-11 rounded-xl border bg-white px-3 font-bold normal-case"><option value="mantencion">Mantención</option><option value="reparacion">Reparación</option><option value="documento">Documento</option><option value="inspeccion">Inspección</option><option value="otro">Otro</option></select></label>
        <label className="grid gap-1 text-xs font-black uppercase">Registro<input value={formRegistro.titulo} onChange={(e) => setFormRegistro({ ...formRegistro, titulo: e.target.value })} placeholder="Ej: Cambio de aceite" className="h-11 rounded-xl border px-3 font-bold normal-case" /></label>
        <label className="grid gap-1 text-xs font-black uppercase">Política de alerta<select value={formRegistro.politica_id} onChange={(e) => setFormRegistro({ ...formRegistro, politica_id: e.target.value })} className="h-11 rounded-xl border bg-white px-3 font-bold normal-case"><option value="">Sin política</option>{politicas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
        {[['fecha','Fecha','date'],['kilometraje','Kilometraje','text'],['costo','Costo','text'],['proxima_fecha','Próxima fecha','date'],['proximo_kilometraje','Próximo kilometraje','text']].map(([campo, etiqueta, tipo]) => <label key={campo} className="grid gap-1 text-xs font-black uppercase">{etiqueta}<input type={tipo} value={formRegistro[campo as keyof typeof formRegistro]} onChange={(e) => setFormRegistro({ ...formRegistro, [campo]: e.target.value })} className="h-11 rounded-xl border px-3 font-bold normal-case" /></label>)}
        <label className="grid gap-1 text-xs font-black uppercase md:col-span-2">Detalle<input value={formRegistro.detalle} onChange={(e) => setFormRegistro({ ...formRegistro, detalle: e.target.value })} className="h-11 rounded-xl border px-3 font-bold normal-case" /></label>
      </div><div className="mt-4 flex justify-end"><button type="button" disabled={guardando} onClick={guardarRegistro} className="rounded-xl bg-red-700 px-6 py-3 font-black text-white disabled:opacity-50">Guardar registro</button></div></section>
      <section className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-maruxa-chocolate">Historial</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-[#3b2116] text-white"><tr><th className="p-2 text-left">Fecha</th><th className="p-2 text-left">Registro</th><th className="p-2 text-left">Tipo</th><th className="p-2 text-right">Km</th><th className="p-2 text-right">Costo</th><th className="p-2 text-left">Próxima alerta</th><th></th></tr></thead><tbody>{registrosActuales.map((r) => <tr key={r.id} className="border-b"><td className="p-2 font-bold">{fecha(r.fecha)}</td><td className="p-2 font-black">{r.titulo}</td><td className="p-2 capitalize">{r.tipo}</td><td className="p-2 text-right">{r.kilometraje ? numero(r.kilometraje).toLocaleString('es-CL') : '—'}</td><td className="p-2 text-right">{dinero(r.costo)}</td><td className="p-2">{r.proxima_fecha ? fecha(r.proxima_fecha) : ''}{r.proxima_fecha && r.proximo_kilometraje ? ' · ' : ''}{r.proximo_kilometraje ? `${numero(r.proximo_kilometraje).toLocaleString('es-CL')} km` : '—'}</td><td className="p-2"><button type="button" onClick={() => eliminarRegistro(r.id)} className="text-red-700"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div></section>
    </>}
  </div>;
}
