'use client';

import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type WheelEvent,
} from 'react';
import { ArrowDown, ArrowUp, Loader2, Save, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdminSession } from '@/components/AdminSession';

type Cliente = {
  id: string;
  razon_social: string;
  sigla: string | null;
  repartidor_nombre: string | null;
  precio_base: number | null;
  activo: boolean;
};

type Funcionario = {
  id: string;
  nombre_completo: string;
  cargo: string;
};

type Planilla = {
  id: string;
  anio: number;
  mes: number;
  repartidor_id: string | null;
  repartidor_nombre: string;
  saldo_inicial: number;
  estado: string;
  observaciones: string | null;
};

type Detalle = {
  id?: string;
  cliente_id: string | null;
  cliente_sigla: string;
  cliente_nombre: string | null;
  fecha: string;
  precio_unitario: number;
  kilos_vendidos: number;
  kilos_devueltos: number;
  monto_ajuste: number;
};

type Fila = {
  key: string;
  cliente_id: string | null;
  sigla: string;
  nombre: string;
  precio: number;
  dias: Record<number, { vendidos: number; devueltos: number; ajuste: number }>;
};

function numero(valor: unknown) {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function kilos(valor: unknown) {
  return Math.max(0, numero(valor));
}

function dinero(valor: number) {
  return `$${Math.round(valor).toLocaleString('es-CL')}`;
}

function diasDelMes(anio: number, mes: number) {
  return new Date(anio, mes, 0).getDate();
}

function fechaDia(anio: number, mes: number, dia: number) {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function letraDiaSemana(anio: number, mes: number, dia: number) {
  const letras = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  return letras[new Date(anio, mes - 1, dia).getDay()] || '';
}

function esDomingo(anio: number, mes: number, dia: number) {
  return new Date(anio, mes - 1, dia).getDay() === 0;
}

function nombreMes(mes: number) {
  return new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(
    new Date(2026, mes - 1, 1)
  );
}

const mesesDelAnio = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function moverVertical(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== 'Enter') return;

  const input = event.currentTarget;
  const columna = input.dataset.columna;

  if (!columna) return;

  const fila = input.closest('tr');
  const siguienteFila = event.shiftKey
    ? fila?.previousElementSibling
    : fila?.nextElementSibling;
  const siguiente = siguienteFila?.querySelector<HTMLInputElement>(
    `input[data-columna="${columna}"]`
  );

  if (!siguiente) return;

  event.preventDefault();
  siguiente.focus();
  siguiente.select();
}

function evitarCambioNumeroConRueda(event: WheelEvent<HTMLDivElement>) {
  const objetivo = event.target;

  if (objetivo instanceof HTMLInputElement && objetivo.type === 'number') {
    objetivo.blur();
  }
}

function filaDesdeCliente(cliente: Cliente): Fila {
  return {
    key: cliente.id,
    cliente_id: cliente.id,
    sigla: cliente.sigla || cliente.razon_social,
    nombre: cliente.razon_social,
    precio: Number(cliente.precio_base || 0),
    dias: {},
  };
}

function ordenClientesGuardado(valor: string | null | undefined): string[] {
  if (!valor) return [];

  try {
    const datos = JSON.parse(valor);
    return Array.isArray(datos?.orden_clientes)
      ? datos.orden_clientes.filter(
          (item: unknown): item is string => typeof item === 'string'
        )
      : [];
  } catch {
    return [];
  }
}

export default function RepartosPage() {
  const { perfil } = useAdminSession();
  const hoy = new Date();
  const [anio, setAnio] = useState(2026);
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [repartidor, setRepartidor] = useState('');
  const [repartidorId, setRepartidorId] = useState<string | null>(null);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [abonos, setAbonos] = useState<Record<number, number>>({});
  const [planilla, setPlanilla] = useState<Planilla | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const anioActual = hoy.getFullYear();
  const aniosDisponibles = Array.from(
    { length: Math.max(anioActual + 1, anio) - 2023 },
    (_, indice) => Math.max(anioActual + 1, anio) - indice
  );

  function limpiarPlanillaAbierta() {
    setPlanilla(null);
    setFilas([]);
    setAbonos({});
    setSaldoInicial(0);
  }

  async function cargarBase() {
    if (!perfil) return;
    setCargando(true);

    const [{ data: funcionariosData }, { data: clientesData, error: errorClientes }] =
      await Promise.all([
        supabase
          .from('funcionarios')
          .select('id,nombre_completo,cargo')
          .eq('empresa_id', perfil.empresa_id)
          .eq('activo', true)
          .order('nombre_completo'),
        supabase
          .from('clientes')
          .select('id,razon_social,sigla,repartidor_nombre,precio_base,activo')
          .eq('empresa_id', perfil.empresa_id)
          .eq('activo', true)
          .order('razon_social'),
      ]);

    if (errorClientes) {
      alert(errorClientes.message);
      setCargando(false);
      return;
    }

    const repartidores = ((funcionariosData || []) as Funcionario[]).filter(
      (item) => item.cargo.toLowerCase() === 'repartidor'
    );

    setFuncionarios(repartidores);
    setClientes((clientesData || []) as Cliente[]);

    if (!repartidor && repartidores[0]) {
      setRepartidor(repartidores[0].nombre_completo);
      setRepartidorId(repartidores[0].id);
    }

    setCargando(false);
  }

  useEffect(() => {
    cargarBase();
  }, [perfil]);

  const dias = useMemo(
    () => Array.from({ length: diasDelMes(anio, mes) }, (_, i) => i + 1),
    [anio, mes]
  );

  const resumen = useMemo(() => {
    let kilosVendidos = 0;
    let kilosDevueltos = 0;
    let ventaBruta = 0;
    let devolucion = 0;
    let ajustes = 0;

    filas.forEach((fila) => {
      dias.forEach((dia) => {
        const celda = fila.dias[dia] || { vendidos: 0, devueltos: 0, ajuste: 0 };
        kilosVendidos += celda.vendidos;
        kilosDevueltos += celda.devueltos;
        ventaBruta += celda.vendidos * fila.precio;
        devolucion += celda.devueltos * fila.precio;
        ajustes += celda.ajuste;
      });
    });

    const totalAbonos = Object.values(abonos).reduce(
      (total, valor) => total + numero(valor),
      0
    );
    const neto = ventaBruta - devolucion + ajustes;

    return {
      kilosVendidos,
      kilosDevueltos,
      ventaBruta,
      devolucion,
      ajustes,
      neto,
      totalAbonos,
      saldo: saldoInicial + neto - totalAbonos,
    };
  }, [abonos, dias, filas, saldoInicial]);

  function clientesDelRepartidor() {
    const nombre = repartidor.toLowerCase().trim();
    const filtrados = clientes.filter(
      (cliente) =>
        cliente.repartidor_nombre?.toLowerCase().trim() === nombre ||
        !cliente.repartidor_nombre
    );

    return filtrados.length > 0 ? filtrados : clientes;
  }

  async function abrirPlanilla() {
    if (!perfil || !repartidor.trim()) {
      alert('Selecciona un repartidor.');
      return;
    }

    setCargando(true);

    let { data: planillaData, error: errorPlanilla } = await supabase
      .from('reparto_planillas')
      .select('*')
      .eq('empresa_id', perfil.empresa_id)
      .eq('anio', anio)
      .eq('mes', mes)
      .eq('repartidor_nombre', repartidor.trim())
      .limit(1)
      .maybeSingle();

    if (!errorPlanilla && !planillaData) {
      const resultadoCreacion = await supabase
        .from('reparto_planillas')
        .insert({
          empresa_id: perfil.empresa_id,
          anio,
          mes,
          repartidor_id: repartidorId,
          repartidor_nombre: repartidor.trim(),
          saldo_inicial: 0,
        })
        .select('*')
        .single();

      planillaData = resultadoCreacion.data;
      errorPlanilla = resultadoCreacion.error;
    }

    if (errorPlanilla || !planillaData) {
      alert(errorPlanilla?.message || 'No se pudo cargar la planilla.');
      setCargando(false);
      return;
    }

    setPlanilla(planillaData as Planilla);
    setSaldoInicial(Number(planillaData.saldo_inicial || 0));

    const [{ data: detallesData }, { data: abonosData }] = await Promise.all([
      supabase
        .from('reparto_planilla_detalles')
        .select('*')
        .eq('planilla_id', planillaData.id),
      supabase
        .from('reparto_planilla_abonos')
        .select('*')
        .eq('planilla_id', planillaData.id),
    ]);

    const baseFilas = clientesDelRepartidor().map(filaDesdeCliente);
    const mapa = new Map(baseFilas.map((fila) => [fila.sigla, fila]));
    const filasPorClienteId = new Map(
      baseFilas
        .filter((fila) => fila.cliente_id)
        .map((fila) => [fila.cliente_id as string, fila])
    );

    ((detallesData || []) as Detalle[]).forEach((detalle) => {
      const dia = Number(String(detalle.fecha).slice(8, 10));
      const existente =
        (detalle.cliente_id
          ? filasPorClienteId.get(detalle.cliente_id)
          : undefined) ||
        mapa.get(detalle.cliente_sigla) ||
        {
          key: detalle.cliente_sigla,
          cliente_id: detalle.cliente_id,
          sigla: detalle.cliente_sigla,
          nombre: detalle.cliente_nombre || detalle.cliente_sigla,
          precio: Number(detalle.precio_unitario || 0),
          dias: {},
        };

      existente.precio = Number(detalle.precio_unitario || existente.precio || 0);
      const celdaExistente = existente.dias[dia] || {
        vendidos: 0,
        devueltos: 0,
        ajuste: 0,
      };
      existente.dias[dia] = {
        vendidos:
          celdaExistente.vendidos + kilos(detalle.kilos_vendidos),
        devueltos:
          celdaExistente.devueltos + kilos(detalle.kilos_devueltos),
        ajuste: celdaExistente.ajuste + Number(detalle.monto_ajuste || 0),
      };
      mapa.set(existente.sigla, existente);
      if (existente.cliente_id) {
        filasPorClienteId.set(existente.cliente_id, existente);
      }
    });

    const abonosPorDia: Record<number, number> = {};
    (abonosData || []).forEach((abono: any) => {
      const dia = Number(String(abono.fecha).slice(8, 10));
      abonosPorDia[dia] = Number(abono.monto || 0);
    });

    const ordenGuardado = ordenClientesGuardado(planillaData.observaciones);
    const posicionGuardada = new Map<string, number>(
      ordenGuardado.map((key, indice) => [key, indice])
    );
    const filasCargadas = Array.from(mapa.values()).sort((a, b) => {
      const posicionA = posicionGuardada.get(a.key);
      const posicionB = posicionGuardada.get(b.key);
      if (posicionA === undefined && posicionB === undefined) return 0;
      if (posicionA === undefined) return 1;
      if (posicionB === undefined) return -1;
      return posicionA - posicionB;
    });

    setFilas(filasCargadas);
    setAbonos(abonosPorDia);
    setCargando(false);
  }

  useEffect(() => {
    if (!perfil || !repartidor.trim()) return;
    void abrirPlanilla();
  }, [perfil, anio, mes, repartidor, repartidorId, clientes]);

  function actualizarCelda(
    filaKey: string,
    dia: number,
    campo: 'vendidos' | 'devueltos' | 'ajuste',
    valor: string
  ) {
    setFilas((actuales) =>
      actuales.map((fila) => {
        if (fila.key !== filaKey) return fila;
        const celda = fila.dias[dia] || { vendidos: 0, devueltos: 0, ajuste: 0 };
        return {
          ...fila,
          dias: {
            ...fila.dias,
            [dia]: {
              ...celda,
              [campo]: campo === 'ajuste' ? numero(valor) : kilos(valor),
            },
          },
        };
      })
    );
  }

  function actualizarPrecio(filaKey: string, valor: string) {
    setFilas((actuales) =>
      actuales.map((fila) =>
        fila.key === filaKey ? { ...fila, precio: numero(valor) } : fila
      )
    );
  }

  function moverFila(filaKey: string, direccion: -1 | 1) {
    setFilas((actuales) => {
      const indice = actuales.findIndex((fila) => fila.key === filaKey);
      const destino = indice + direccion;
      if (indice < 0 || destino < 0 || destino >= actuales.length) return actuales;

      const siguientes = [...actuales];
      [siguientes[indice], siguientes[destino]] = [
        siguientes[destino],
        siguientes[indice],
      ];
      return siguientes;
    });
  }

  async function guardarPlanilla() {
    if (!planilla) {
      await abrirPlanilla();
      return;
    }

    setGuardando(true);

    const { error: errorPlanilla } = await supabase
      .from('reparto_planillas')
      .update({
        saldo_inicial: saldoInicial,
        observaciones: JSON.stringify({
          orden_clientes: filas.map((fila) => fila.key),
        }),
      })
      .eq('id', planilla.id);

    if (errorPlanilla) {
      alert(errorPlanilla.message);
      setGuardando(false);
      return;
    }

    await supabase.from('reparto_planilla_detalles').delete().eq('planilla_id', planilla.id);
    await supabase.from('reparto_planilla_abonos').delete().eq('planilla_id', planilla.id);

    const detalles = filas.flatMap((fila) =>
      dias.flatMap((dia) => {
        const celda = fila.dias[dia] || { vendidos: 0, devueltos: 0, ajuste: 0 };
        if (!celda.vendidos && !celda.devueltos && !celda.ajuste) return [];
        return {
          planilla_id: planilla.id,
          cliente_id: fila.cliente_id,
          cliente_sigla: fila.sigla,
          cliente_nombre: fila.nombre,
          fecha: fechaDia(anio, mes, dia),
          precio_unitario: fila.precio,
          kilos_vendidos: celda.vendidos,
          kilos_devueltos: celda.devueltos,
          monto_ajuste: celda.ajuste,
        };
      })
    );

    const abonosGuardar = Object.entries(abonos)
      .filter(([, monto]) => numero(monto) > 0)
      .map(([dia, monto]) => ({
        planilla_id: planilla.id,
        fecha: fechaDia(anio, mes, Number(dia)),
        monto: numero(monto),
      }));

    if (detalles.length > 0) {
      const { error } = await supabase.from('reparto_planilla_detalles').insert(detalles);
      if (error) {
        alert(error.message);
        setGuardando(false);
        return;
      }
    }

    if (abonosGuardar.length > 0) {
      const { error } = await supabase.from('reparto_planilla_abonos').insert(abonosGuardar);
      if (error) {
        alert(error.message);
        setGuardando(false);
        return;
      }
    }

    setGuardando(false);
    alert('Planilla guardada.');
  }

  function totalDia(dia: number, tipo: 'vendidos' | 'devueltos' | 'monto' | 'devolucion') {
    return filas.reduce((total, fila) => {
      const celda = fila.dias[dia] || { vendidos: 0, devueltos: 0, ajuste: 0 };
      if (tipo === 'vendidos') return total + celda.vendidos;
      if (tipo === 'devueltos') return total + celda.devueltos;
      if (tipo === 'devolucion') return total + celda.devueltos * fila.precio;
      return total + celda.vendidos * fila.precio + celda.ajuste;
    }, 0);
  }

  return (
    <div className="space-y-5 pb-12" onWheel={evitarCambioNumeroConRueda}>
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#A51F2B]">
            Comercial
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#2A1710]">
            Repartos mensuales
          </h1>
          <p className="mt-1 text-sm font-semibold text-[#4B2818]/65">
            Registro de kilos vendidos, devoluciones y abonos por repartidor.
          </p>
        </div>

      </header>

      <nav className="flex overflow-x-auto rounded-lg border border-[#4B2818]/15 bg-white p-1">
        {mesesDelAnio.map((nombre, indice) => {
          const numeroMes = indice + 1;
          const activo = numeroMes === mes;

          return (
            <button
              key={nombre}
              type="button"
              onClick={() => {
                setMes(numeroMes);
                limpiarPlanillaAbierta();
              }}
              className={`min-w-max flex-1 rounded-md px-3 py-2 text-xs font-black transition ${
                activo
                  ? 'bg-[#A51F2B] text-white'
                  : 'text-[#4B2818] hover:bg-[#FFF3DF]'
              }`}
            >
              {nombre}
            </button>
          );
        })}
      </nav>

      <section className="grid gap-3 rounded-lg border border-[#4B2818]/15 bg-white p-4 md:grid-cols-2 xl:grid-cols-[120px_minmax(260px,1fr)_180px] xl:items-end">
        <label className="grid gap-1 text-xs font-black text-[#4B2818]">
          Año
          <select
            value={anio}
            onChange={(e) => {
              setAnio(Number(e.target.value));
              limpiarPlanillaAbierta();
            }}
            className="h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold"
          >
            {aniosDisponibles.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs font-black text-[#4B2818]">
          Repartidor
          <select
            value={repartidor}
            onChange={(e) => {
              const seleccionado = funcionarios.find(
                (item) => item.nombre_completo === e.target.value
              );
              setRepartidor(e.target.value);
              setRepartidorId(seleccionado?.id || null);
              limpiarPlanillaAbierta();
            }}
            className="h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold"
          >
            <option value="">Seleccionar</option>
            {funcionarios.map((funcionario) => (
              <option key={funcionario.id} value={funcionario.nombre_completo}>
                {funcionario.nombre_completo}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs font-black text-[#4B2818]">
          Saldo inicial
          <input
            type="number"
            value={saldoInicial || ''}
            onChange={(e) => setSaldoInicial(numero(e.target.value))}
            className="sin-spinner h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold"
          />
        </label>

      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          ['Venta bruta', dinero(resumen.ventaBruta)],
          ['Devolucion', dinero(resumen.devolucion)],
          ['Neto mes', dinero(resumen.neto)],
          ['Saldo', dinero(resumen.saldo)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[#4B2818]/15 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#4B2818]/55">
              {label}
            </p>
            <p className="mt-1 text-2xl font-black text-[#2A1710]">{value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
        <div className="flex items-center gap-2 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-4 py-3">
          <Truck className="h-5 w-5 text-[#A51F2B]" />
          <h2 className="font-black text-[#2A1710]">
            {repartidor || 'Selecciona repartidor'} - {nombreMes(mes)} {anio}
          </h2>
        </div>

        {!planilla ? (
          <p className="p-8 text-center text-sm font-bold text-[#4B2818]/60">
            {cargando
              ? 'Cargando planilla...'
              : 'Selecciona un repartidor para registrar ventas y devoluciones.'}
          </p>
        ) : (
          <div className="max-h-[620px] overflow-auto">
            <table
              className="table-fixed border-collapse text-xs"
              style={{ width: 190 + 96 + dias.length * 128 + 112 }}
            >
              <colgroup>
                <col style={{ width: 190 }} />
                <col style={{ width: 96 }} />
                {dias.flatMap((dia) => [
                  <col key={`${dia}-vendidos-col`} style={{ width: 64 }} />,
                  <col key={`${dia}-devueltos-col`} style={{ width: 64 }} />,
                ])}
                <col style={{ width: 112 }} />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[#2A1710] text-white">
                <tr>
                  <th className="sticky left-0 z-20 w-[190px] min-w-[190px] max-w-[190px] bg-[#2A1710] px-2 py-2 text-left">
                    Cliente
                  </th>
                  <th className="sticky left-[190px] z-20 w-24 min-w-24 max-w-24 bg-[#2A1710] px-2 py-2 text-right">
                    Precio
                  </th>
                  {dias.map((dia) => {
                    const domingo = esDomingo(anio, mes, dia);

                    return (
                      <th
                        key={dia}
                        className={`border-l px-2 py-1 text-center ${
                          domingo
                            ? 'border-amber-500 bg-amber-400 text-amber-950'
                            : 'border-white/10'
                        }`}
                        colSpan={2}
                      >
                        <span className="block text-[10px] font-black">
                          {letraDiaSemana(anio, mes, dia)}
                        </span>
                        <span className="block">{dia}</span>
                      </th>
                    );
                  })}
                  <th className="border-l border-white/10 px-2 py-2 text-right">Total</th>
                </tr>
                <tr>
                  <th className="sticky left-0 z-20 bg-[#2A1710]" />
                  <th className="sticky left-[190px] z-20 bg-[#2A1710]" />
                  {dias.map((dia) => {
                    const domingo = esDomingo(anio, mes, dia);

                    return (
                    <>
                      <th key={`${dia}-v`} className={`border-l px-2 py-1 text-center ${domingo ? 'border-amber-500 bg-amber-400 text-amber-950' : 'border-white/10'}`}>
                        V
                      </th>
                      <th key={`${dia}-d`} className={`px-2 py-1 text-center ${domingo ? 'bg-amber-400 text-amber-950' : ''}`}>
                        D
                      </th>
                    </>
                    );
                  })}
                  <th />
                </tr>
              </thead>
              <tbody>
                {filas.map((fila, indice) => (
                  <tr key={fila.key} className="border-b border-[#4B2818]/10 hover:bg-[#FFF3DF]/45">
                    <td className="sticky left-0 z-[5] w-[190px] min-w-[190px] max-w-[190px] overflow-hidden bg-white px-2 py-1 font-black uppercase text-[#2A1710]">
                      <div className="flex items-center gap-1">
                        <div className="no-print flex shrink-0 gap-0.5">
                          <button type="button" disabled={indice === 0} onClick={() => moverFila(fila.key, -1)} title="Subir cliente" aria-label={`Subir ${fila.nombre}`} className="rounded border border-[#4B2818]/15 p-1 text-[#A51F2B] disabled:opacity-25"><ArrowUp className="h-3.5 w-3.5" /></button>
                          <button type="button" disabled={indice === filas.length - 1} onClick={() => moverFila(fila.key, 1)} title="Bajar cliente" aria-label={`Bajar ${fila.nombre}`} className="rounded border border-[#4B2818]/15 p-1 text-[#A51F2B] disabled:opacity-25"><ArrowDown className="h-3.5 w-3.5" /></button>
                        </div>
                        <span className="block min-w-0 truncate" title={fila.nombre}>{fila.sigla}</span>
                      </div>
                    </td>
                    <td className="sticky left-[190px] z-[5] w-24 min-w-24 max-w-24 bg-white px-2 py-1">
                      <input
                        type="number"
                        data-columna="precio"
                        value={fila.precio || ''}
                        onChange={(e) => actualizarPrecio(fila.key, e.target.value)}
                        onKeyDown={moverVertical}
                        className="sin-spinner h-8 w-20 rounded border border-[#4B2818]/15 px-2 text-right font-bold"
                      />
                    </td>
                    {dias.map((dia) => {
                      const celda = fila.dias[dia] || {
                        vendidos: 0,
                        devueltos: 0,
                        ajuste: 0,
                      };
                      return (
                        <>
                          <td key={`${fila.key}-${dia}-v`} className={`border-l border-[#4B2818]/10 px-1 py-1 ${esDomingo(anio, mes, dia) ? 'bg-amber-100' : ''}`}>
                            <input
                              type="number"
                              min="0"
                              data-columna={`${dia}-vendidos`}
                              value={celda.vendidos || ''}
                              onChange={(e) =>
                                actualizarCelda(fila.key, dia, 'vendidos', e.target.value)
                              }
                              onKeyDown={moverVertical}
                              className="sin-spinner h-8 w-14 rounded border border-[#4B2818]/15 px-1 text-right font-bold"
                            />
                          </td>
                          <td key={`${fila.key}-${dia}-d`} className={`px-1 py-1 ${esDomingo(anio, mes, dia) ? 'bg-amber-100' : ''}`}>
                            <input
                              type="number"
                              min="0"
                              data-columna={`${dia}-devueltos`}
                              value={celda.devueltos || ''}
                              onChange={(e) =>
                                actualizarCelda(fila.key, dia, 'devueltos', e.target.value)
                              }
                              onKeyDown={moverVertical}
                              className="sin-spinner h-8 w-14 rounded border border-red-200 bg-red-50 px-1 text-right font-bold text-red-800"
                            />
                          </td>
                        </>
                      );
                    })}
                    <td className="border-l border-[#4B2818]/10 px-2 py-1 text-right font-black text-[#A51F2B]">
                      {dinero(
                        dias.reduce((total, dia) => {
                          const celda = fila.dias[dia] || {
                            vendidos: 0,
                            devueltos: 0,
                            ajuste: 0,
                          };
                          return (
                            total +
                            celda.vendidos * fila.precio -
                            celda.devueltos * fila.precio +
                            celda.ajuste
                          );
                        }, 0)
                      )}
                    </td>
                  </tr>
                ))}

                <tr className="border-t-2 border-[#2A1710] bg-[#FFF3DF] font-black">
                  <td className="sticky left-0 z-[5] bg-[#FFF3DF] px-2 py-2">Total kg</td>
                  <td className="sticky left-[190px] z-[5] bg-[#FFF3DF]" />
                  {dias.map((dia) => (
                    <>
                      <td key={`${dia}-tv`} className={`border-l border-[#4B2818]/10 px-2 py-2 text-right ${esDomingo(anio, mes, dia) ? 'bg-amber-200' : ''}`}>
                        {totalDia(dia, 'vendidos').toLocaleString('es-CL')}
                      </td>
                      <td key={`${dia}-td`} className={`px-2 py-2 text-right text-red-700 ${esDomingo(anio, mes, dia) ? 'bg-amber-200' : ''}`}>
                        {totalDia(dia, 'devueltos').toLocaleString('es-CL')}
                      </td>
                    </>
                  ))}
                  <td />
                </tr>

                <tr className="bg-white font-black">
                  <td className="sticky left-0 z-[5] bg-white px-2 py-2">Monto dia</td>
                  <td className="sticky left-[190px] z-[5] bg-white" />
                  {dias.map((dia) => (
                    <>
                      <td key={`${dia}-mv`} className={`border-l border-[#4B2818]/10 px-2 py-2 text-right ${esDomingo(anio, mes, dia) ? 'bg-amber-100' : ''}`}>
                        {dinero(totalDia(dia, 'monto'))}
                      </td>
                      <td key={`${dia}-md`} className={`px-2 py-2 text-right text-red-700 ${esDomingo(anio, mes, dia) ? 'bg-amber-100' : ''}`}>
                        {dinero(totalDia(dia, 'devolucion'))}
                      </td>
                    </>
                  ))}
                  <td />
                </tr>

                <tr className="bg-emerald-50 font-black">
                  <td className="sticky left-0 z-[5] bg-emerald-50 px-2 py-2">Abono</td>
                  <td className="sticky left-[190px] z-[5] bg-emerald-50" />
                  {dias.map((dia) => (
                    <>
                      <td key={`${dia}-ab`} className={`border-l border-[#4B2818]/10 px-1 py-1 ${esDomingo(anio, mes, dia) ? 'bg-amber-100' : ''}`} colSpan={2}>
                        <input
                          type="number"
                          value={abonos[dia] || ''}
                          onChange={(e) =>
                            setAbonos((actual) => ({
                              ...actual,
                              [dia]: numero(e.target.value),
                            }))
                          }
                          className="sin-spinner h-8 w-28 rounded border border-emerald-200 bg-white px-2 text-right font-bold text-emerald-800"
                        />
                      </td>
                    </>
                  ))}
                  <td className="px-2 py-2 text-right">{dinero(resumen.totalAbonos)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={guardarPlanilla}
          disabled={guardando || cargando}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#A51F2B] px-6 text-sm font-black text-white disabled:opacity-60"
        >
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </button>
      </div>
    </div>
  );
}
