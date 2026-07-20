'use client';

import { useEffect, useMemo, useState } from 'react';
import { Factory, Plus, Printer, Save, Trash2 } from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';
import { supabase } from '@/lib/supabase';

type Equipo = {
  id: string; codigo: string; nombre: string; combustible: 'petroleo' | 'gas';
  unidad_nivel: 'litros' | 'porcentaje'; capacidad_estanque: number | null; activo: boolean;
};

type Carga = {
  id: string; equipo_id: string; fecha: string; numero_documento: string | null;
  proveedor: string | null; precio_litro: number; monto_factura: number;
  litros_cargados: number; nivel_restante: number; observacion: string | null; origen: string;
};

type CargaCalculada = Carga & {
  dias: number | null; litros_ocupados: number | null; litros_diarios: number | null;
  gasto_diario_neto: number | null; alerta: string | null;
};

const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const formInicial = {
  equipo_id: '', fecha: new Date().toISOString().slice(0, 10), tipo_documento: 'factura',
  numero_documento: '', proveedor: '', precio_litro: '', monto_factura: '',
  litros_cargados: '', nivel_restante: '', observacion: '',
};

function numero(valor: string | number | null | undefined) {
  const texto = String(valor ?? 0).trim();
  if (!texto) return 0;
  const normalizado = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto;
  return Number(normalizado) || 0;
}

function dinero(valor: number | null | undefined) {
  return `$${Math.round(Number(valor || 0)).toLocaleString('es-CL')}`;
}

function decimal(valor: number | null | undefined, digitos = 2) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return valor.toLocaleString('es-CL', { minimumFractionDigits: digitos, maximumFractionDigits: digitos });
}

function fechaLocal(valor: string) {
  return new Date(`${valor}T12:00:00`).toLocaleDateString('es-CL');
}

function diasEntre(desde: string, hasta: string) {
  return Math.round((new Date(`${hasta}T12:00:00`).getTime() -
    new Date(`${desde}T12:00:00`).getTime()) / 86400000);
}

function etiquetaCombustible(valor: Equipo['combustible']) {
  return valor === 'gas' ? 'Gas' : 'Petróleo';
}

function restanteEnLitros(carga: Pick<Carga, 'nivel_restante'>, equipo?: Equipo) {
  return equipo?.unidad_nivel === 'porcentaje'
    ? numero(equipo.capacidad_estanque) * numero(carga.nivel_restante) / 100
    : numero(carga.nivel_restante);
}

function documentoTexto(valor: string | null) {
  if (!valor) return '—';
  const [tipo, numeroDocumento] = valor.includes('|') ? valor.split('|', 2) : ['factura', valor];
  const etiquetas: Record<string, string> = { factura: 'Factura', guia: 'Guía', boleta: 'Boleta' };
  return `${etiquetas[tipo] || 'Documento'} ${numeroDocumento}`;
}

function formularioGuardado(equipoId: string) {
  if (!equipoId || typeof window === 'undefined') return { ...formInicial, equipo_id: equipoId };
  try {
    const guardado = window.localStorage.getItem(`maruxa:combustible-hornos:borrador:${equipoId}`);
    return guardado
      ? { ...formInicial, ...JSON.parse(guardado), equipo_id: equipoId }
      : { ...formInicial, equipo_id: equipoId };
  } catch {
    return { ...formInicial, equipo_id: equipoId };
  }
}

function calcularConsumo(cargas: Carga[], equipos: Equipo[]) {
  const resultado: CargaCalculada[] = [];
  const equipoPorId = new Map(equipos.map((equipo) => [equipo.id, equipo]));
  const grupos = new Map<string, Carga[]>();
  cargas.forEach((carga) => grupos.set(carga.equipo_id, [...(grupos.get(carga.equipo_id) || []), carga]));

  grupos.forEach((grupo, equipoId) => {
    const equipo = equipoPorId.get(equipoId);
    let anterior: Carga | null = null;
    grupo.sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach((carga) => {
      let dias: number | null = null;
      let litrosOcupados: number | null = null;
      let litrosDiarios: number | null = null;
      let gastoDiarioNeto: number | null = null;
      let alerta: string | null = null;
      if (anterior) {
        dias = diasEntre(anterior.fecha, carga.fecha);
        litrosOcupados = numero(anterior.litros_cargados) + restanteEnLitros(anterior, equipo) - restanteEnLitros(carga, equipo);
        if (dias <= 0) alerta = 'La fecha debe ser posterior al registro anterior';
        else if (litrosOcupados < 0) alerta = 'El nivel restante supera el combustible disponible';
        else {
          litrosDiarios = litrosOcupados / dias;
          gastoDiarioNeto = litrosDiarios * numero(anterior.precio_litro);
        }
      }
      resultado.push({ ...carga, dias, litros_ocupados: litrosOcupados,
        litros_diarios: litrosDiarios, gasto_diario_neto: gastoDiarioNeto, alerta });
      anterior = carga;
    });
  });
  return resultado.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export default function CombustibleHornosPage() {
  const { perfil } = useAdminSession();
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorModulo, setErrorModulo] = useState('');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [equipoFiltro, setEquipoFiltro] = useState('');
  const [mostrarEquipo, setMostrarEquipo] = useState(false);
  const [formEquipo, setFormEquipo] = useState({ nombre: '', combustible: 'petroleo' as Equipo['combustible'],
    unidad_nivel: 'litros' as Equipo['unidad_nivel'], capacidad_estanque: '' });
  const [form, setForm] = useState(formInicial);

  async function cargarDatos() {
    if (!perfil) return;
    setCargando(true); setErrorModulo('');
    const [equiposResp, cargasResp] = await Promise.all([
      supabase.from('combustible_hornos_equipos')
        .select('id,codigo,nombre,combustible,unidad_nivel,capacidad_estanque,activo')
        .eq('empresa_id', perfil.empresa_id).eq('activo', true).order('nombre'),
      supabase.from('combustible_hornos_cargas')
        .select('id,equipo_id,fecha,numero_documento,proveedor,precio_litro,monto_factura,litros_cargados,nivel_restante,observacion,origen')
        .eq('empresa_id', perfil.empresa_id).order('fecha', { ascending: true }),
    ]);
    if (equiposResp.error || cargasResp.error) {
      setErrorModulo(equiposResp.error?.message || cargasResp.error?.message || 'No se pudo cargar el módulo.');
      setCargando(false); return;
    }
    const equiposData = (equiposResp.data as Equipo[]) || [];
    const cargasData = (cargasResp.data as Carga[]) || [];
    setEquipos(equiposData); setCargas(cargasData);
    const equipoSeleccionado = equipoFiltro || equiposData[0]?.id || '';
    setEquipoFiltro(equipoSeleccionado);
    setForm(formularioGuardado(equipoSeleccionado));
    const anios = cargasData.map((carga) => Number(carga.fecha.slice(0, 4)));
    if (anios.length && !anios.includes(anio)) setAnio(Math.max(...anios));
    setCargando(false);
  }

  useEffect(() => { void cargarDatos(); }, [perfil]);

  useEffect(() => {
    if (!equipoFiltro || typeof window === 'undefined') return;
    try { window.localStorage.setItem(`maruxa:combustible-hornos:borrador:${equipoFiltro}`, JSON.stringify(form)); }
    catch { /* El formulario funciona aunque el navegador bloquee el almacenamiento. */ }
  }, [equipoFiltro, form]);

  const equipoActual = equipos.find((equipo) => equipo.id === equipoFiltro);
  const cargasCalculadas = useMemo(() => calcularConsumo(cargas, equipos), [cargas, equipos]);
  const cargasFiltradas = useMemo(() => cargasCalculadas.filter((carga) =>
    carga.equipo_id === equipoFiltro && Number(carga.fecha.slice(0, 4)) === anio),
  [anio, cargasCalculadas, equipoFiltro]);

  const resumen = useMemo(() => {
    const litrosCargados = cargasFiltradas.reduce((s, c) => s + numero(c.litros_cargados), 0);
    const litrosOcupados = cargasFiltradas.reduce((s, c) => s + Math.max(0, numero(c.litros_ocupados)), 0);
    const gasto = cargasFiltradas.reduce((s, c) => s + numero(c.monto_factura), 0);
    const dias = cargasFiltradas.reduce((s, c) => s + Math.max(0, numero(c.dias)), 0);
    const costoIntervalos = cargasFiltradas.reduce((s, c) => s + numero(c.gasto_diario_neto) * numero(c.dias), 0);
    const costoLitros = cargasFiltradas.reduce((s, c) => s + numero(c.precio_litro) * numero(c.litros_cargados), 0);
    return { litrosCargados, litrosOcupados, gasto, consumoDiario: dias ? litrosOcupados / dias : 0,
      gastoDiario: dias ? costoIntervalos / dias : 0,
      precioPromedio: litrosCargados ? costoLitros / litrosCargados : 0 };
  }, [cargasFiltradas]);

  const resumenMensual = useMemo(() => meses.map((mes, indice) => {
    const datos = cargasFiltradas.filter((carga) => Number(carga.fecha.slice(5, 7)) === indice + 1);
    const litrosCargados = datos.reduce((s, c) => s + numero(c.litros_cargados), 0);
    const litrosOcupados = datos.reduce((s, c) => s + Math.max(0, numero(c.litros_ocupados)), 0);
    const gasto = datos.reduce((s, c) => s + numero(c.monto_factura), 0);
    const dias = datos.reduce((s, c) => s + Math.max(0, numero(c.dias)), 0);
    return { mes, cargas: datos.length, litrosCargados, litrosOcupados, gasto,
      consumoDiario: dias ? litrosOcupados / dias : 0 };
  }).filter((item) => item.cargas > 0), [cargasFiltradas]);

  const cargaAnterior = [...cargas].filter((carga) => carga.equipo_id === equipoFiltro && carga.fecha < form.fecha)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  const nivelFormulario = numero(form.nivel_restante);
  const nivelFormularioLitros = equipoActual?.unidad_nivel === 'porcentaje'
    ? numero(equipoActual.capacidad_estanque) * nivelFormulario / 100 : nivelFormulario;
  const diasFormulario = cargaAnterior ? diasEntre(cargaAnterior.fecha, form.fecha) : null;
  const litrosOcupadosFormulario = cargaAnterior
    ? numero(cargaAnterior.litros_cargados) + restanteEnLitros(cargaAnterior, equipoActual) - nivelFormularioLitros : null;
  const litrosDiaFormulario = diasFormulario && diasFormulario > 0 && litrosOcupadosFormulario !== null && litrosOcupadosFormulario >= 0
    ? litrosOcupadosFormulario / diasFormulario : null;
  const gastoDiaFormulario = litrosDiaFormulario === null || !cargaAnterior ? null
    : litrosDiaFormulario * numero(cargaAnterior.precio_litro);
  const litrosFormulario = numero(form.litros_cargados);
  const precioFormulario = numero(form.precio_litro);
  const gastoFormulario = numero(form.monto_factura);
  const gastoCalculado = gastoFormulario || precioFormulario * litrosFormulario * 1.19;
  const precioCalculado = precioFormulario || (litrosFormulario > 0 && gastoFormulario > 0
    ? gastoFormulario / 1.19 / litrosFormulario : 0);

  const aniosDisponibles = useMemo(() => {
    const valores = new Set(cargas.map((carga) => Number(carga.fecha.slice(0, 4))));
    valores.add(new Date().getFullYear()); return [...valores].sort((a, b) => b - a);
  }, [cargas]);

  async function guardarEquipo() {
    if (!perfil || !formEquipo.nombre.trim()) return;
    const capacidad = numero(formEquipo.capacidad_estanque);
    if (formEquipo.unidad_nivel === 'porcentaje' && capacidad <= 0) {
      alert('Indica la capacidad del estanque para calcular el porcentaje restante.'); return;
    }
    const codigo = formEquipo.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase();
    setGuardando(true);
    const { error } = await supabase.from('combustible_hornos_equipos').insert({
      empresa_id: perfil.empresa_id, codigo, nombre: formEquipo.nombre.trim(),
      combustible: formEquipo.combustible, unidad_nivel: formEquipo.unidad_nivel,
      capacidad_estanque: formEquipo.unidad_nivel === 'porcentaje' ? capacidad : null,
    });
    setGuardando(false);
    if (error) return alert(error.code === '23505' ? 'Ya existe un sistema con ese nombre.' : error.message);
    setMostrarEquipo(false);
    setFormEquipo({ nombre: '', combustible: 'petroleo', unidad_nivel: 'litros', capacidad_estanque: '' });
    await cargarDatos();
  }

  async function guardarCarga() {
    if (!perfil || !equipoActual || !form.fecha) return;
    if (!form.nivel_restante.trim()) {
      alert('Ingresa el nivel restante del estanque.'); return;
    }
    if (equipoActual.unidad_nivel === 'porcentaje' && (nivelFormulario < 0 || nivelFormulario > 100)) {
      alert('El nivel restante debe estar entre 0% y 100%.'); return;
    }
    if (litrosFormulario <= 0) { alert('Ingresa los litros cargados.'); return; }
    if (precioFormulario <= 0 && gastoFormulario <= 0) {
      alert('Ingresa el precio neto por litro o el total de la factura.'); return;
    }
    if (cargaAnterior && diasFormulario !== null && diasFormulario <= 0) {
      alert('La fecha debe ser posterior al registro anterior.'); return;
    }
    if (litrosOcupadosFormulario !== null && litrosOcupadosFormulario < 0) {
      alert('El nivel restante supera el combustible disponible según el registro anterior.'); return;
    }
    const montoFinal = gastoFormulario || precioFormulario * litrosFormulario * 1.19;
    const precioFinal = precioFormulario || montoFinal / 1.19 / litrosFormulario;
    setGuardando(true);
    const { error } = await supabase.from('combustible_hornos_cargas').insert({
      empresa_id: perfil.empresa_id, equipo_id: equipoActual.id, fecha: form.fecha,
      numero_documento: form.numero_documento.trim() ? `${form.tipo_documento}|${form.numero_documento.trim()}` : null,
      proveedor: form.proveedor.trim() || null, precio_litro: precioFinal, monto_factura: montoFinal,
      litros_cargados: litrosFormulario, nivel_restante: nivelFormulario,
      observacion: form.observacion.trim() || null,
    });
    setGuardando(false);
    if (error) return alert(error.message);
    if (typeof window !== 'undefined') window.localStorage.removeItem(`maruxa:combustible-hornos:borrador:${equipoFiltro}`);
    setForm({ ...formInicial, equipo_id: equipoFiltro, fecha: form.fecha });
    await cargarDatos();
  }

  async function eliminarCarga(id: string) {
    if (!confirm('¿Eliminar este registro de combustible de hornos?')) return;
    const { error } = await supabase.from('combustible_hornos_cargas').delete().eq('id', id);
    if (error) return alert(error.message); await cargarDatos();
  }

  function seleccionarEquipo(equipoId: string) {
    setEquipoFiltro(equipoId);
    setForm(formularioGuardado(equipoId));
  }

  return <div className="space-y-6 pb-12">
    <style jsx global>{`@media print { body * { visibility: hidden !important; } .hornos-print, .hornos-print * { visibility: visible !important; } .hornos-print { position: absolute; inset: 0; width: 100%; } .no-print { display: none !important; } }`}</style>
    <header className="no-print flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><p className="text-xs font-black uppercase tracking-widest text-maruxa-rojo">Informes</p>
        <h1 className="mt-1 text-3xl font-black text-maruxa-chocolate">Combustible de hornos</h1>
        <p className="mt-2 text-sm font-bold text-maruxa-cafe/65">Control de petróleo y gas, consumo diario, gasto y nivel de estanques.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setMostrarEquipo(!mostrarEquipo)} className="rounded-full border-2 border-red-700 bg-white px-5 py-3 text-sm font-black text-red-700"><Plus className="mr-2 inline h-4 w-4" />Nuevo sistema</button>
        <button type="button" onClick={() => window.print()} className="rounded-full bg-[#3b2116] px-5 py-3 text-sm font-black text-white shadow-lg"><Printer className="mr-2 inline h-4 w-4" />Imprimir</button>
      </div>
    </header>
    {errorModulo && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-800">No se pudo abrir el módulo: {errorModulo}</div>}

    {mostrarEquipo && <section className="no-print grid gap-3 rounded-3xl bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_170px_170px_170px_auto] xl:items-end">
      <label className="grid gap-1 text-xs font-black uppercase text-maruxa-cafe/60">Nombre<input value={formEquipo.nombre} onChange={(e) => setFormEquipo({ ...formEquipo, nombre: e.target.value })} placeholder="Ej: Estanque horno 1" className="h-11 rounded-xl border px-3 text-sm font-bold normal-case" /></label>
      <label className="grid gap-1 text-xs font-black uppercase text-maruxa-cafe/60">Combustible<select value={formEquipo.combustible} onChange={(e) => setFormEquipo({ ...formEquipo, combustible: e.target.value as Equipo['combustible'] })} className="h-11 rounded-xl border bg-white px-3 text-sm font-bold normal-case"><option value="petroleo">Petróleo</option><option value="gas">Gas</option></select></label>
      <label className="grid gap-1 text-xs font-black uppercase text-maruxa-cafe/60">Nivel medido<select value={formEquipo.unidad_nivel} onChange={(e) => setFormEquipo({ ...formEquipo, unidad_nivel: e.target.value as Equipo['unidad_nivel'] })} className="h-11 rounded-xl border bg-white px-3 text-sm font-bold normal-case"><option value="litros">Litros</option><option value="porcentaje">Porcentaje</option></select></label>
      <label className="grid gap-1 text-xs font-black uppercase text-maruxa-cafe/60">Capacidad<input disabled={formEquipo.unidad_nivel !== 'porcentaje'} inputMode="decimal" value={formEquipo.capacidad_estanque} onChange={(e) => setFormEquipo({ ...formEquipo, capacidad_estanque: e.target.value })} placeholder="Ej: 1655" className="h-11 rounded-xl border px-3 text-sm font-bold normal-case disabled:bg-stone-100" /></label>
      <button type="button" disabled={guardando} onClick={guardarEquipo} className="h-11 rounded-xl bg-red-700 px-5 font-black text-white disabled:opacity-50">Guardar</button>
    </section>}

    <section className="no-print grid gap-3 rounded-3xl bg-white p-5 shadow-sm md:grid-cols-2">
      <label className="grid gap-1 text-xs font-black uppercase text-maruxa-cafe/60">Año<select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="h-11 rounded-xl border bg-white px-3 text-sm font-bold normal-case">{aniosDisponibles.map((valor) => <option key={valor}>{valor}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-black uppercase text-maruxa-cafe/60">Sistema de combustible<select value={equipoFiltro} onChange={(e) => seleccionarEquipo(e.target.value)} className="h-11 rounded-xl border bg-white px-3 text-sm font-bold normal-case"><option value="">Seleccionar</option>{equipos.map((equipo) => <option key={equipo.id} value={equipo.id}>{equipo.nombre} · {etiquetaCombustible(equipo.combustible)}</option>)}</select></label>
    </section>

    <div className="hornos-print space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ['Litros cargados', decimal(resumen.litrosCargados, 1)], ['Litros ocupados', decimal(resumen.litrosOcupados, 1)],
          ['Gasto facturas', dinero(resumen.gasto)], ['Consumo diario', `${decimal(resumen.consumoDiario)} l/día`],
          ['Costo diario neto', dinero(resumen.gastoDiario)], ['Precio litro neto', dinero(resumen.precioPromedio)],
        ].map(([titulo, valor]) => <div key={titulo} className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-[11px] font-black uppercase text-maruxa-cafe/55">{titulo}</p><p className="mt-2 text-2xl font-black text-maruxa-chocolate">{valor}</p></div>)}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-maruxa-chocolate">Resumen mensual {anio}</h2>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-red-700 text-white"><tr><th className="px-3 py-2 text-left">MES</th><th className="px-3 py-2 text-right">CARGAS</th><th className="px-3 py-2 text-right">LITROS CARGADOS</th><th className="px-3 py-2 text-right">LITROS OCUPADOS</th><th className="px-3 py-2 text-right">GASTO</th><th className="px-3 py-2 text-right">LITROS/DÍA</th></tr></thead><tbody>{resumenMensual.map((item) => <tr key={item.mes} className="border-b"><td className="px-3 py-2 font-black">{item.mes}</td><td className="px-3 py-2 text-right">{item.cargas}</td><td className="px-3 py-2 text-right">{decimal(item.litrosCargados, 1)}</td><td className="px-3 py-2 text-right">{decimal(item.litrosOcupados, 1)}</td><td className="px-3 py-2 text-right">{dinero(item.gasto)}</td><td className="px-3 py-2 text-right font-black">{decimal(item.consumoDiario)}</td></tr>)}</tbody></table></div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><Factory className="h-5 w-5 text-red-700" /><h2 className="text-xl font-black text-maruxa-chocolate">Planilla de cargas</h2></div>
        <p className="no-print mt-1 text-xs font-bold text-maruxa-cafe/55">Registra el nivel del estanque al momento de cada carga. Los cálculos se muestran inmediatamente.</p>
        {!equipoFiltro ? <div className="no-print mt-4 rounded-2xl border-2 border-dashed border-red-200 bg-red-50/50 px-5 py-10 text-center font-black text-maruxa-cafe/65">Selecciona un sistema para abrir su planilla.</div> : cargando ? <p className="py-10 text-center font-bold">Cargando...</p> : <div className="mt-4 overflow-x-auto rounded-2xl border border-maruxa-cafe/15">
          <table className="w-full min-w-[1500px] text-xs">
            <thead className="bg-[#3b2116] font-black uppercase tracking-wide text-white"><tr><th className="px-2 py-3 text-left">FECHA</th><th className="px-2 py-3 text-left">SISTEMA</th><th className="px-2 py-3 text-left">DOCUMENTO</th><th className="px-2 py-3 text-left">PROVEEDOR</th><th className="px-2 py-3 text-right">$/L NETO</th><th className="px-2 py-3 text-right">LITROS CARGADOS</th><th className="px-2 py-3 text-right">NIVEL RESTANTE</th><th className="px-2 py-3 text-right">FACTURA</th><th className="px-2 py-3 text-right">DÍAS</th><th className="px-2 py-3 text-right">LITROS OCUPADOS</th><th className="px-2 py-3 text-right">LITROS/DÍA</th><th className="px-2 py-3 text-right">$/DÍA NETO</th><th className="no-print px-2 py-3"></th></tr></thead>
            <tbody>
              <tr className="no-print border-b-2 border-red-700 bg-red-50/70 align-middle">
                <td className="p-1"><input aria-label="Fecha nueva carga" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="h-11 w-[135px] rounded-lg border bg-white px-2 font-bold" /></td>
                <td className="p-1"><div className="flex h-11 w-[150px] items-center rounded-lg border bg-white px-2 font-black">{equipoActual?.nombre}</div></td>
                <td className="p-1"><div className="grid w-[190px] grid-cols-[90px_1fr] gap-1"><select aria-label="Tipo documento" value={form.tipo_documento} onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })} className="h-11 rounded-lg border bg-white px-1 font-bold"><option value="factura">Factura</option><option value="guia">Guía</option><option value="boleta">Boleta</option></select><input aria-label="Número documento" value={form.numero_documento} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} placeholder="Número" className="h-11 min-w-0 rounded-lg border bg-white px-2 text-right font-bold" /></div></td>
                <td className="p-1"><input aria-label="Proveedor" value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} placeholder="Proveedor" className="h-11 w-[130px] rounded-lg border bg-white px-2 font-bold" /></td>
                <td className="p-1"><input aria-label="Precio neto por litro" inputMode="numeric" value={form.precio_litro} onChange={(e) => setForm({ ...form, precio_litro: e.target.value.replace(/\D/g, '') })} placeholder={precioCalculado ? dinero(precioCalculado) : 'Neto'} className="h-11 w-[90px] rounded-lg border bg-white px-2 text-right font-bold" /></td>
                <td className="p-1"><input aria-label="Litros cargados" inputMode="decimal" value={form.litros_cargados} onChange={(e) => setForm({ ...form, litros_cargados: e.target.value })} placeholder="Litros" className="h-11 w-[95px] rounded-lg border bg-white px-2 text-right font-bold" /></td>
                <td className="p-1"><div className="relative"><input aria-label="Nivel restante" inputMode="decimal" value={form.nivel_restante} onChange={(e) => setForm({ ...form, nivel_restante: e.target.value })} placeholder="Nivel" className="h-11 w-[105px] rounded-lg border bg-white px-2 pr-7 text-right font-bold" /><span className="absolute right-2 top-3 font-black text-maruxa-cafe/50">{equipoActual?.unidad_nivel === 'porcentaje' ? '%' : 'L'}</span></div></td>
                <td className="p-1"><input aria-label="Total factura" inputMode="numeric" value={form.monto_factura} onChange={(e) => setForm({ ...form, monto_factura: e.target.value.replace(/\D/g, '') })} placeholder={gastoCalculado ? dinero(gastoCalculado) : 'Total'} className="h-11 w-[105px] rounded-lg border bg-white px-2 text-right font-bold" /></td>
                <td className="px-2 py-3 text-right font-black text-emerald-800">{diasFormulario ?? '—'}</td><td className="px-2 py-3 text-right font-black text-emerald-800">{decimal(litrosOcupadosFormulario)}</td><td className="px-2 py-3 text-right font-black text-emerald-800">{decimal(litrosDiaFormulario)}</td><td className="px-2 py-3 text-right font-black text-emerald-800">{gastoDiaFormulario === null ? '—' : dinero(gastoDiaFormulario)}</td>
                <td className="p-1"><button type="button" disabled={guardando} onClick={guardarCarga} className="flex h-11 items-center gap-1 rounded-lg bg-red-700 px-3 font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{guardando ? 'Guardando' : 'Guardar'}</button></td>
              </tr>
              {[...cargasFiltradas].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((carga) => <tr key={carga.id} title={carga.alerta || carga.observacion || undefined} className={`border-b ${carga.alerta ? 'bg-red-50' : ''}`}><td className="px-2 py-2 font-bold">{fechaLocal(carga.fecha)}</td><td className="px-2 py-2 font-black">{equipoActual?.nombre}</td><td className="px-2 py-2">{documentoTexto(carga.numero_documento)}</td><td className="px-2 py-2">{carga.proveedor || '—'}</td><td className="px-2 py-2 text-right">{dinero(carga.precio_litro)}</td><td className="px-2 py-2 text-right">{decimal(carga.litros_cargados, 1)}</td><td className="px-2 py-2 text-right">{decimal(carga.nivel_restante, equipoActual?.unidad_nivel === 'porcentaje' ? 1 : 0)} {equipoActual?.unidad_nivel === 'porcentaje' ? '%' : 'L'}</td><td className="px-2 py-2 text-right">{dinero(carga.monto_factura)}</td><td className="px-2 py-2 text-right">{carga.dias ?? '—'}</td><td className="px-2 py-2 text-right">{decimal(carga.litros_ocupados)}</td><td className="px-2 py-2 text-right font-black">{decimal(carga.litros_diarios)}</td><td className="px-2 py-2 text-right">{carga.gasto_diario_neto === null ? '—' : dinero(carga.gasto_diario_neto)}</td><td className="no-print px-2 py-2 text-right"><button type="button" onClick={() => eliminarCarga(carga.id)} className="rounded-lg p-2 text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></td></tr>)}
            </tbody>
          </table>
        </div>}
      </section>
    </div>
  </div>;
}
