'use client';

import { useEffect, useMemo, useState } from 'react';
import { Car, Printer, Save, Trash2 } from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';
import { supabase } from '@/lib/supabase';

type Vehiculo = {
  id: string;
  codigo: string;
  nombre: string;
  patente: string | null;
  repartidor_id: string | null;
  kilometraje_actual: number;
  activo: boolean;
};

type Repartidor = {
  id: string;
  nombre_completo: string;
};

type Carga = {
  id: string;
  vehiculo_id: string;
  fecha: string;
  conductor_nombre: string | null;
  numero_guia: string | null;
  precio_litro: number;
  monto_guia: number;
  litros: number;
  kilometraje: number | null;
  observacion: string | null;
  origen: string;
};

type CargaCalculada = Carga & {
  dias: number | null;
  km_recorridos: number | null;
  litros_intervalo: number | null;
  rendimiento: number | null;
  litros_diarios: number | null;
  gasto_diario: number | null;
  alerta: string | null;
};

const meses = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function numero(valor: string | number | null | undefined) {
  return Number(String(valor ?? 0).replace(',', '.')) || 0;
}

function dinero(valor: number | null | undefined) {
  return `$${Math.round(Number(valor || 0)).toLocaleString('es-CL')}`;
}

function decimal(valor: number | null | undefined, digitos = 2) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return valor.toLocaleString('es-CL', {
    minimumFractionDigits: digitos,
    maximumFractionDigits: digitos,
  });
}

function fechaLocal(valor: string) {
  return new Date(`${valor}T12:00:00`).toLocaleDateString('es-CL');
}

function documentoTexto(valor: string | null | undefined) {
  if (!valor) return '—';
  const [tipo, numeroDocumento] = valor.includes('|')
    ? valor.split('|', 2)
    : ['guia', valor];
  const etiquetas: Record<string, string> = {
    guia: 'Guía',
    boleta: 'Boleta',
    factura: 'Factura',
  };
  return `${etiquetas[tipo] || 'Documento'} ${numeroDocumento}`.trim();
}

function diasEntre(desde: string, hasta: string) {
  return Math.round(
    (new Date(`${hasta}T12:00:00`).getTime() -
      new Date(`${desde}T12:00:00`).getTime()) /
      86400000
  );
}

function calcularRendimiento(cargas: Carga[]) {
  const resultado: CargaCalculada[] = [];
  const porVehiculo = new Map<string, Carga[]>();

  cargas.forEach((carga) => {
    const grupo = porVehiculo.get(carga.vehiculo_id) || [];
    grupo.push(carga);
    porVehiculo.set(carga.vehiculo_id, grupo);
  });

  porVehiculo.forEach((grupo) => {
    let kilometrajeAnterior: number | null = null;
    let fechaAnterior: string | null = null;
    let litrosPendientes = 0;

    grupo
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .forEach((carga) => {
        const dias = fechaAnterior ? diasEntre(fechaAnterior, carga.fecha) : null;
        litrosPendientes += numero(carga.litros);
        let kmRecorridos: number | null = null;
        let litrosIntervalo: number | null = null;
        let rendimiento: number | null = null;
        let alerta: string | null = null;
        const kilometraje = carga.kilometraje === null
          ? null
          : numero(carga.kilometraje);

        if (kilometraje !== null) {
          if (kilometrajeAnterior !== null) {
            if (kilometraje > kilometrajeAnterior) {
              kmRecorridos = kilometraje - kilometrajeAnterior;
              litrosIntervalo = litrosPendientes;
              rendimiento = litrosPendientes > 0
                ? kmRecorridos / litrosPendientes
                : null;
              kilometrajeAnterior = kilometraje;
              litrosPendientes = 0;
            } else {
              alerta = 'Kilometraje menor o igual al registro anterior';
            }
          } else {
            kilometrajeAnterior = kilometraje;
            litrosPendientes = 0;
          }
        }

        resultado.push({
          ...carga,
          dias,
          km_recorridos: kmRecorridos,
          litros_intervalo: litrosIntervalo,
          rendimiento,
          litros_diarios: dias && dias > 0 ? numero(carga.litros) / dias : null,
          gasto_diario: dias && dias > 0 ? numero(carga.monto_guia) / dias : null,
          alerta,
        });
        fechaAnterior = carga.fecha;
      });
  });

  return resultado.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export default function RendimientoVehiculosPage() {
  const { perfil } = useAdminSession();
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [repartidores, setRepartidores] = useState<Repartidor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorModulo, setErrorModulo] = useState('');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [vehiculoFiltro, setVehiculoFiltro] = useState('');
  const [mostrarVehiculo, setMostrarVehiculo] = useState(false);
  const [formVehiculo, setFormVehiculo] = useState({ nombre: '', patente: '', repartidor_id: '' });
  const [form, setForm] = useState({
    vehiculo_id: '',
    fecha: new Date().toISOString().slice(0, 10),
    conductor_nombre: '',
    tipo_documento: 'guia',
    numero_guia: '',
    precio_litro: '',
    monto_guia: '',
    litros: '',
    kilometraje: '',
    observacion: '',
  });

  async function cargarDatos() {
    if (!perfil) return;
    setCargando(true);
    setErrorModulo('');

    const [vehiculosResp, cargasResp, funcionariosResp] = await Promise.all([
      supabase
        .from('vehiculos_reparto')
        .select('id,codigo,nombre,patente,repartidor_id,kilometraje_actual,activo')
        .eq('empresa_id', perfil.empresa_id)
        .eq('activo', true)
        .order('nombre'),
      supabase
        .from('combustible_cargas')
        .select('id,vehiculo_id,fecha,conductor_nombre,numero_guia,precio_litro,monto_guia,litros,kilometraje,observacion,origen')
        .eq('empresa_id', perfil.empresa_id)
        .order('fecha', { ascending: true }),
      supabase
        .from('funcionarios')
        .select('id,nombre_completo,cargo')
        .eq('empresa_id', perfil.empresa_id)
        .eq('activo', true)
        .order('nombre_completo'),
    ]);

    if (vehiculosResp.error || cargasResp.error) {
      setErrorModulo(
        vehiculosResp.error?.message || cargasResp.error?.message ||
          'No se pudo cargar el módulo.'
      );
      setCargando(false);
      return;
    }

    const vehiculosData = (vehiculosResp.data as Vehiculo[]) || [];
    const cargasData = (cargasResp.data as Carga[]) || [];
    setVehiculos(vehiculosData);
    setCargas(cargasData);
    setRepartidores(
      (funcionariosResp.data || [])
        .filter((item) => String(item.cargo || '').toLowerCase() === 'repartidor')
        .map((item) => ({ id: item.id, nombre_completo: item.nombre_completo }))
    );
    const anios = cargasData.map((carga) => Number(carga.fecha.slice(0, 4)));
    if (anios.length && !anios.includes(anio)) setAnio(Math.max(...anios));
    setCargando(false);
  }

  useEffect(() => {
    void cargarDatos();
  }, [perfil]);

  const cargasCalculadas = useMemo(() => calcularRendimiento(cargas), [cargas]);
  const cargasFiltradas = useMemo(
    () =>
      cargasCalculadas.filter(
        (carga) =>
          Number(carga.fecha.slice(0, 4)) === anio &&
          carga.vehiculo_id === vehiculoFiltro
      ),
    [anio, cargasCalculadas, vehiculoFiltro]
  );

  const resumen = useMemo(() => {
    const litros = cargasFiltradas.reduce((suma, carga) => suma + numero(carga.litros), 0);
    const gasto = cargasFiltradas.reduce((suma, carga) => suma + numero(carga.monto_guia), 0);
    const kilometros = cargasFiltradas.reduce(
      (suma, carga) => suma + numero(carga.km_recorridos), 0
    );
    const litrosConRendimiento = cargasFiltradas.reduce(
      (suma, carga) => suma + numero(carga.litros_intervalo), 0
    );

    return {
      litros,
      gasto,
      kilometros,
      rendimiento: litrosConRendimiento > 0 ? kilometros / litrosConRendimiento : 0,
      costoKm: kilometros > 0 ? gasto / kilometros : 0,
      precioPromedio: litros > 0 ? gasto / litros : 0,
    };
  }, [cargasFiltradas]);

  const resumenMensual = useMemo(
    () =>
      meses.map((mes, indice) => {
        const datos = cargasFiltradas.filter(
          (carga) => Number(carga.fecha.slice(5, 7)) === indice + 1
        );
        const litros = datos.reduce((suma, carga) => suma + numero(carga.litros), 0);
        const gasto = datos.reduce((suma, carga) => suma + numero(carga.monto_guia), 0);
        const kilometros = datos.reduce(
          (suma, carga) => suma + numero(carga.km_recorridos), 0
        );
        const litrosIntervalo = datos.reduce(
          (suma, carga) => suma + numero(carga.litros_intervalo), 0
        );
        return {
          mes,
          cargas: datos.length,
          litros,
          gasto,
          kilometros,
          rendimiento: litrosIntervalo > 0 ? kilometros / litrosIntervalo : 0,
        };
      }).filter((item) => item.cargas > 0),
    [cargasFiltradas]
  );

  const aniosDisponibles = useMemo(() => {
    const valores = new Set(cargas.map((carga) => Number(carga.fecha.slice(0, 4))));
    valores.add(new Date().getFullYear());
    return [...valores].sort((a, b) => b - a);
  }, [cargas]);

  async function guardarVehiculo() {
    const nombre = formVehiculo.nombre.trim();
    if (!perfil || !nombre) return;
    setGuardando(true);
    const codigo = (formVehiculo.patente || nombre)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toUpperCase();
    const { error } = await supabase.from('vehiculos_reparto').insert({
      empresa_id: perfil.empresa_id,
      codigo,
      nombre,
      patente: formVehiculo.patente.trim() || null,
      repartidor_id: formVehiculo.repartidor_id || null,
    });
    setGuardando(false);
    if (error) return alert(error.message);
    setFormVehiculo({ nombre: '', patente: '', repartidor_id: '' });
    setMostrarVehiculo(false);
    await cargarDatos();
  }

  async function asignarRepartidor(repartidorId: string) {
    if (!vehiculoFiltro) return;
    setGuardando(true);
    const { error } = await supabase
      .from('vehiculos_reparto')
      .update({ repartidor_id: repartidorId || null })
      .eq('id', vehiculoFiltro);
    setGuardando(false);
    if (error) {
      alert(error.code === '23505'
        ? 'Este repartidor ya está asignado a otro vehículo.'
        : error.message);
      return;
    }
    setVehiculos((actuales) => actuales.map((vehiculo) =>
      vehiculo.id === vehiculoFiltro
        ? { ...vehiculo, repartidor_id: repartidorId || null }
        : vehiculo
    ));
    const repartidor = repartidores.find((item) => item.id === repartidorId);
    setForm((actual) => ({
      ...actual,
      conductor_nombre: repartidor?.nombre_completo || '',
    }));
  }

  async function guardarCarga() {
    if (!perfil || !form.vehiculo_id || !form.fecha || !form.conductor_nombre || numero(form.litros) <= 0) {
      alert('Completa vehículo, fecha, repartidor y litros.');
      return;
    }

    const kilometraje = form.kilometraje ? numero(form.kilometraje) : null;
    const anteriores = cargas
      .filter(
        (carga) =>
          carga.vehiculo_id === form.vehiculo_id &&
          carga.fecha <= form.fecha &&
          carga.kilometraje !== null
      )
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (
      kilometraje !== null &&
      anteriores[0]?.kilometraje !== null &&
      kilometraje <= numero(anteriores[0]?.kilometraje)
    ) {
      alert(`El kilometraje debe ser mayor a ${numero(anteriores[0].kilometraje).toLocaleString('es-CL')}.`);
      return;
    }

    setGuardando(true);
    const montoCalculado = numero(form.precio_litro) * numero(form.litros);
    const { error } = await supabase.from('combustible_cargas').insert({
      empresa_id: perfil.empresa_id,
      vehiculo_id: form.vehiculo_id,
      fecha: form.fecha,
      conductor_nombre: form.conductor_nombre.trim() || null,
      numero_guia: form.numero_guia.trim()
        ? `${form.tipo_documento}|${form.numero_guia.trim()}`
        : null,
      precio_litro: numero(form.precio_litro),
      monto_guia: numero(form.monto_guia) || montoCalculado,
      litros: numero(form.litros),
      kilometraje,
      observacion: form.observacion.trim() || null,
    });
    setGuardando(false);
    if (error) return alert(error.message);
    const vehiculoActual = vehiculos.find((item) => item.id === form.vehiculo_id);
    if (kilometraje !== null && kilometraje > numero(vehiculoActual?.kilometraje_actual)) {
      await supabase
        .from('vehiculos_reparto')
        .update({ kilometraje_actual: kilometraje })
        .eq('id', form.vehiculo_id);
    }
    setForm((actual) => ({
      ...actual,
      numero_guia: '',
      precio_litro: '',
      monto_guia: '',
      litros: '',
      kilometraje: '',
      observacion: '',
    }));
    await cargarDatos();
  }

  async function eliminarCarga(id: string) {
    if (!confirm('¿Eliminar este registro de combustible?')) return;
    const { error } = await supabase.from('combustible_cargas').delete().eq('id', id);
    if (error) return alert(error.message);
    await cargarDatos();
  }

  return (
    <div className="space-y-6 pb-12">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .vehiculos-print, .vehiculos-print * { visibility: visible !important; }
          .vehiculos-print { position: absolute; inset: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <header className="no-print flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-maruxa-rojo">Informes</p>
          <h1 className="mt-1 text-3xl font-black text-maruxa-chocolate">Rendimiento anual de vehículos</h1>
          <p className="mt-2 text-sm font-bold text-maruxa-cafe/65">
            Control de combustible, kilometraje, gasto y rendimiento por vehículo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMostrarVehiculo(!mostrarVehiculo)} className="rounded-full border-2 border-red-700 bg-white px-5 py-3 text-sm font-black text-red-700">
            <Car className="mr-2 inline h-4 w-4" />Nuevo vehículo
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-full bg-[#3b2116] px-5 py-3 text-sm font-black text-white shadow-lg transition-colors hover:bg-[#2a1710]">
            <Printer className="mr-2 inline h-4 w-4" />Imprimir
          </button>
        </div>
      </header>

      {errorModulo && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-800">
          No se pudo abrir el módulo: {errorModulo}
        </div>
      )}

      {mostrarVehiculo && (
        <section className="no-print grid gap-3 rounded-3xl bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-[1fr_190px_1fr_auto] xl:items-end">
          <label className="grid gap-1 text-xs font-black uppercase text-maruxa-cafe/60">Nombre
            <input value={formVehiculo.nombre} onChange={(e) => setFormVehiculo({ ...formVehiculo, nombre: e.target.value })} placeholder="Ej: Furgón sala de ventas" className="h-11 rounded-xl border px-3 text-sm font-bold normal-case" />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-maruxa-cafe/60">Patente
            <input value={formVehiculo.patente} onChange={(e) => setFormVehiculo({ ...formVehiculo, patente: e.target.value.toUpperCase() })} placeholder="AB CD-12" className="h-11 rounded-xl border px-3 text-sm font-bold normal-case" />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-maruxa-cafe/60">Repartidor asignado
            <select value={formVehiculo.repartidor_id} onChange={(e) => setFormVehiculo({ ...formVehiculo, repartidor_id: e.target.value })} className="h-11 rounded-xl border bg-white px-3 text-sm font-bold normal-case"><option value="">Sin asignar</option>{repartidores.map((repartidor) => <option key={repartidor.id} value={repartidor.id}>{repartidor.nombre_completo}</option>)}</select>
          </label>
          <button type="button" disabled={guardando} onClick={guardarVehiculo} className="h-11 rounded-xl bg-red-700 px-5 font-black text-white disabled:opacity-50">Guardar</button>
        </section>
      )}

      <section className="no-print grid gap-3 rounded-3xl bg-white p-5 shadow-sm md:grid-cols-3">
        <label className="grid gap-1 text-xs font-black uppercase text-maruxa-cafe/60">Año
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="h-11 rounded-xl border bg-white px-3 text-sm font-bold normal-case">{aniosDisponibles.map((valor) => <option key={valor}>{valor}</option>)}</select>
        </label>
        <label className="grid gap-1 text-xs font-black uppercase text-maruxa-cafe/60">Vehículo de la planilla
          <select value={vehiculoFiltro} onChange={(e) => {
            const valor = e.target.value;
            setVehiculoFiltro(valor);
            const vehiculo = vehiculos.find((item) => item.id === valor);
            const repartidor = repartidores.find((item) => item.id === vehiculo?.repartidor_id);
            setForm((actual) => ({
              ...actual,
              vehiculo_id: valor,
              conductor_nombre: repartidor?.nombre_completo || '',
            }));
          }} className="h-11 rounded-xl border bg-white px-3 text-sm font-bold normal-case"><option value="">Selecciona un vehículo</option>{vehiculos.map((vehiculo) => <option key={vehiculo.id} value={vehiculo.id}>{vehiculo.nombre}{vehiculo.patente ? ` · ${vehiculo.patente}` : ''}</option>)}</select>
        </label>
        <label className="grid gap-1 text-xs font-black uppercase text-maruxa-cafe/60">Repartidor asignado
          <select disabled={!vehiculoFiltro || guardando} value={vehiculos.find((vehiculo) => vehiculo.id === vehiculoFiltro)?.repartidor_id || ''} onChange={(e) => void asignarRepartidor(e.target.value)} className="h-11 rounded-xl border bg-white px-3 text-sm font-bold normal-case disabled:bg-stone-100"><option value="">Sin asignar</option>{repartidores.map((repartidor) => <option key={repartidor.id} value={repartidor.id}>{repartidor.nombre_completo}</option>)}</select>
        </label>
      </section>

      <div className="vehiculos-print space-y-6">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ['Kilómetros', resumen.kilometros.toLocaleString('es-CL')],
            ['Litros', decimal(resumen.litros, 1)],
            ['Gasto', dinero(resumen.gasto)],
            ['Rendimiento', `${decimal(resumen.rendimiento)} km/l`],
            ['Costo por km', dinero(resumen.costoKm)],
            ['Precio litro', dinero(resumen.precioPromedio)],
          ].map(([titulo, valor]) => (
            <div key={titulo} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase text-maruxa-cafe/55">{titulo}</p>
              <p className="mt-2 text-2xl font-black text-maruxa-chocolate">{valor}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-maruxa-chocolate">Resumen mensual {anio}</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-red-700 text-white"><tr><th className="px-3 py-2 text-left">Mes</th><th className="px-3 py-2 text-right">Cargas</th><th className="px-3 py-2 text-right">Km</th><th className="px-3 py-2 text-right">Litros</th><th className="px-3 py-2 text-right">Gasto</th><th className="px-3 py-2 text-right">Km/l</th></tr></thead>
              <tbody>{resumenMensual.map((item) => <tr key={item.mes} className="border-b"><td className="px-3 py-2 font-black">{item.mes}</td><td className="px-3 py-2 text-right">{item.cargas}</td><td className="px-3 py-2 text-right">{item.kilometros.toLocaleString('es-CL')}</td><td className="px-3 py-2 text-right">{decimal(item.litros, 1)}</td><td className="px-3 py-2 text-right">{dinero(item.gasto)}</td><td className="px-3 py-2 text-right font-black">{decimal(item.rendimiento)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-maruxa-chocolate">Planilla de cargas</h2>
          <p className="no-print mt-1 text-xs font-bold text-maruxa-cafe/55">
            Ingresa la próxima carga en la última fila. Los cálculos aparecen al guardar.
          </p>
          {!vehiculoFiltro ? (
            <div className="no-print mt-4 rounded-2xl border-2 border-dashed border-red-200 bg-red-50/50 px-5 py-10 text-center font-black text-maruxa-cafe/65">
              Selecciona un vehículo para abrir su planilla de cargas.
            </div>
          ) : cargando ? <p className="py-10 text-center font-bold">Cargando...</p> : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[1450px] text-xs">
                <thead className="bg-maruxa-chocolate text-white"><tr><th className="px-2 py-2 text-left">Fecha</th><th className="px-2 py-2 text-left">Vehículo</th><th className="px-2 py-2 text-left">Repartidor</th><th className="px-2 py-2 text-right">Documento</th><th className="px-2 py-2 text-right">$/litro</th><th className="px-2 py-2 text-right">Litros</th><th className="px-2 py-2 text-right">Gasto</th><th className="px-2 py-2 text-right">Kilometraje</th><th className="px-2 py-2 text-right">Km recorridos</th><th className="px-2 py-2 text-right">Km/l</th><th className="px-2 py-2 text-right">Litros/día</th><th className="px-2 py-2 text-right">$/día</th><th className="no-print px-2 py-2"></th></tr></thead>
                <tbody>
                  {[...cargasFiltradas].reverse().map((carga) => {
                    const vehiculo = vehiculos.find((item) => item.id === carga.vehiculo_id);
                    return <tr key={carga.id} className={`border-b ${carga.alerta ? 'bg-red-50' : carga.origen.startsWith('excel_2024') ? 'bg-blue-50/40' : ''}`}><td className="px-2 py-2 font-bold">{fechaLocal(carga.fecha)}</td><td className="px-2 py-2 font-black">{vehiculo?.nombre || '—'}</td><td className="px-2 py-2">{carga.conductor_nombre || '—'}</td><td className="px-2 py-2 text-right">{documentoTexto(carga.numero_guia)}</td><td className="px-2 py-2 text-right">{dinero(carga.precio_litro)}</td><td className="px-2 py-2 text-right">{decimal(carga.litros, 3)}</td><td className="px-2 py-2 text-right">{dinero(carga.monto_guia)}</td><td className="px-2 py-2 text-right">{carga.kilometraje === null ? 'Pendiente' : numero(carga.kilometraje).toLocaleString('es-CL')}</td><td className="px-2 py-2 text-right">{carga.km_recorridos === null ? '—' : numero(carga.km_recorridos).toLocaleString('es-CL')}</td><td className="px-2 py-2 text-right font-black">{decimal(carga.rendimiento)}</td><td className="px-2 py-2 text-right">{decimal(carga.litros_diarios)}</td><td className="px-2 py-2 text-right">{carga.gasto_diario === null ? '—' : dinero(carga.gasto_diario)}</td><td className="no-print px-2 py-2 text-right"><button type="button" onClick={() => eliminarCarga(carga.id)} className="rounded-lg p-2 text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></td></tr>;
                  })}
                  <tr className="no-print border-t-2 border-red-700 bg-red-50/60 align-top">
                    <td className="p-1"><input aria-label="Fecha nueva carga" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="h-10 w-[135px] rounded-lg border bg-white px-2 font-bold" /></td>
                    <td className="p-1"><div className="flex h-10 w-[190px] items-center rounded-lg border bg-red-100 px-2 font-black">{vehiculos.find((vehiculo) => vehiculo.id === vehiculoFiltro)?.nombre}</div></td>
                    <td className="p-1"><div className="flex h-10 w-[155px] items-center rounded-lg border bg-red-100 px-2 font-black">{form.conductor_nombre || 'Sin asignar'}</div></td>
                    <td className="p-1"><div className="flex w-[170px] gap-1"><select aria-label="Tipo documento" value={form.tipo_documento} onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })} className="h-10 w-[82px] rounded-lg border bg-white px-1 font-bold"><option value="guia">Guía</option><option value="boleta">Boleta</option><option value="factura">Factura</option></select><input aria-label="Número documento" value={form.numero_guia} onChange={(e) => setForm({ ...form, numero_guia: e.target.value })} placeholder="Número" className="h-10 w-[85px] rounded-lg border bg-white px-2 text-right font-bold" /></div></td>
                    <td className="p-1"><input aria-label="Precio litro nueva carga" inputMode="numeric" value={form.precio_litro} onChange={(e) => setForm({ ...form, precio_litro: e.target.value.replace(/\D/g, '') })} placeholder="$0" className="h-10 w-[90px] rounded-lg border bg-white px-2 text-right font-bold" /></td>
                    <td className="p-1"><input aria-label="Litros nueva carga" inputMode="decimal" value={form.litros} onChange={(e) => setForm({ ...form, litros: e.target.value })} placeholder="0,000" className="h-10 w-[90px] rounded-lg border bg-white px-2 text-right font-bold" /></td>
                    <td className="p-1"><input aria-label="Gasto nueva carga" inputMode="numeric" value={form.monto_guia} onChange={(e) => setForm({ ...form, monto_guia: e.target.value.replace(/\D/g, '') })} placeholder={dinero(numero(form.precio_litro) * numero(form.litros))} className="h-10 w-[105px] rounded-lg border bg-white px-2 text-right font-bold" /></td>
                    <td className="p-1"><input aria-label="Kilometraje nueva carga" inputMode="numeric" value={form.kilometraje} onChange={(e) => setForm({ ...form, kilometraje: e.target.value.replace(/\D/g, '') })} placeholder="Kilometraje" className="h-10 w-[110px] rounded-lg border bg-white px-2 text-right font-bold" /></td>
                    <td className="px-2 py-3 text-right text-maruxa-cafe/40">—</td><td className="px-2 py-3 text-right text-maruxa-cafe/40">—</td><td className="px-2 py-3 text-right text-maruxa-cafe/40">—</td><td className="px-2 py-3 text-right text-maruxa-cafe/40">—</td>
                    <td className="p-1"><button type="button" disabled={guardando} onClick={guardarCarga} className="flex h-10 items-center gap-1 rounded-lg bg-red-700 px-3 font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{guardando ? 'Guardando' : 'Guardar'}</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
