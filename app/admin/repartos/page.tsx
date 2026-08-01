'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type WheelEvent,
} from 'react';
import { ArrowDown, ArrowUp, ClipboardPaste, Loader2, Save, X } from 'lucide-react';
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

type BorradorPlanilla = {
  filas: Fila[];
  abonos: Record<number, number>;
  pasteles?: Record<number, number>;
  saldoInicial: number;
  actualizadoEn: string;
};

type ResultadoImportacion = {
  filas: Fila[];
  filasLeidas: number;
  clientesSinDatos: number;
  diasConDatos: number;
  kilosVendidos: number;
  kilosDevueltos: number;
};

function numero(valor: unknown) {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function normalizarNombre(valor: string | null | undefined) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function correspondeAlRepartidor(
  asignado: string | null | undefined,
  seleccionado: string
) {
  const nombreAsignado = normalizarNombre(asignado);
  const nombreSeleccionado = normalizarNombre(seleccionado);
  if (!nombreAsignado) return true;
  if (nombreAsignado === nombreSeleccionado) return true;

  return ['albornoz', 'tapia', 'panaderia'].some(
    (referencia) =>
      nombreAsignado.includes(referencia) &&
      nombreSeleccionado.includes(referencia)
  );
}

function apellidoPestana(nombre: string) {
  const normalizado = normalizarNombre(nombre);
  if (normalizado.includes('tapia')) return 'TAPIA';
  if (normalizado.includes('albornoz')) return 'ALBORNOZ';
  if (normalizado.includes('panaderia')) return 'PANADERIA';

  return (
    nombre
      .trim()
      .split(/\s+/)
      .at(-1)
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase() || 'REPARTO'
  );
}

function reconciliarFilasBorrador(filasCargadas: Fila[], filasBorrador: Fila[]) {
  const resultado = filasBorrador.map((fila) => ({
    ...fila,
    dias: { ...fila.dias },
  }));
  const porClienteId = new Map(
    resultado
      .filter((fila) => fila.cliente_id)
      .map((fila) => [fila.cliente_id as string, fila])
  );
  const porSigla = new Map(resultado.map((fila) => [fila.sigla, fila]));

  filasCargadas.forEach((filaCargada) => {
    const existente =
      (filaCargada.cliente_id
        ? porClienteId.get(filaCargada.cliente_id)
        : undefined) || porSigla.get(filaCargada.sigla);

    if (!existente) {
      const nueva = { ...filaCargada, dias: { ...filaCargada.dias } };
      resultado.push(nueva);
      porSigla.set(nueva.sigla, nueva);
      if (nueva.cliente_id) porClienteId.set(nueva.cliente_id, nueva);
      return;
    }

    existente.cliente_id = filaCargada.cliente_id;
    existente.sigla = filaCargada.sigla;
    existente.nombre = filaCargada.nombre;
    if (!existente.precio) existente.precio = filaCargada.precio;
  });

  return resultado;
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

function moverEnGrilla(event: KeyboardEvent<HTMLInputElement>) {
  const teclasNavegacion = [
    'Enter',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
  ];
  if (!teclasNavegacion.includes(event.key)) return;

  const input = event.currentTarget;
  const columna = input.dataset.columna;
  if (!columna) return;

  const fila = input.closest('tr');
  event.preventDefault();

  let siguiente: HTMLInputElement | null | undefined;
  if (
    event.key === 'Enter' ||
    event.key === 'ArrowUp' ||
    event.key === 'ArrowDown'
  ) {
    const subir = event.key === 'ArrowUp' || (event.key === 'Enter' && event.shiftKey);
    const siguienteFila = subir
      ? fila?.previousElementSibling
      : fila?.nextElementSibling;
    siguiente = siguienteFila?.querySelector<HTMLInputElement>(
      `input[data-columna="${columna}"]`
    );

    if (!siguiente) {
      const coincidenciaDia = columna.match(/^(\d+)-(vendidos|devueltos)$/);
      if (coincidenciaDia) {
        const diaActual = Number(coincidenciaDia[1]);
        const campo = coincidenciaDia[2];
        const diaDestino = diaActual + (subir ? -1 : 1);
        const entradasDestino = Array.from(
          fila?.parentElement?.querySelectorAll<HTMLInputElement>(
            `input[data-columna="${diaDestino}-${campo}"]`
          ) || []
        );
        siguiente = subir
          ? entradasDestino.at(-1) || null
          : entradasDestino[0] || null;
      }
    }
  } else if (fila) {
    const entradas = Array.from(
      fila.querySelectorAll<HTMLInputElement>('input[data-columna]')
    );
    const indice = entradas.indexOf(input);
    siguiente =
      entradas[indice + (event.key === 'ArrowLeft' ? -1 : 1)] || null;
  }

  if (!siguiente) return;
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

function pastelesGuardados(
  valor: string | null | undefined
): Record<number, number> {
  if (!valor) return {};

  try {
    const datos = JSON.parse(valor);
    if (!datos?.pasteles_por_dia || typeof datos.pasteles_por_dia !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(datos.pasteles_por_dia).map(([dia, monto]) => [
        Number(dia),
        numero(monto),
      ])
    );
  } catch {
    return {};
  }
}

function observacionesPlanilla(
  ordenClientes: string[],
  pasteles: Record<number, number>
) {
  return JSON.stringify({
    orden_clientes: ordenClientes,
    pasteles_por_dia: pasteles,
  });
}

function claveBorradorPlanilla(planillaId: string) {
  return `maruxa-repartos-borrador-${planillaId}`;
}

function leerBorradorPlanilla(planillaId: string): BorradorPlanilla | null {
  if (typeof window === 'undefined') return null;

  try {
    const guardado = window.localStorage.getItem(claveBorradorPlanilla(planillaId));
    if (!guardado) return null;
    const borrador = JSON.parse(guardado) as BorradorPlanilla;
    return Array.isArray(borrador?.filas) ? borrador : null;
  } catch {
    return null;
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
  const [pasteles, setPasteles] = useState<Record<number, number>>({});
  const [vistaPlanilla, setVistaPlanilla] = useState<'ingreso' | 'totales'>(
    'ingreso'
  );
  const [cambiosPendientes, setCambiosPendientes] = useState(false);
  const [planilla, setPlanilla] = useState<Planilla | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardandoOrden, setGuardandoOrden] = useState(false);
  const [replicandoOrden, setReplicandoOrden] = useState(false);
  const [mostrarImportador, setMostrarImportador] = useState(false);
  const [textoImportacion, setTextoImportacion] = useState('');
  const [resultadoImportacion, setResultadoImportacion] =
    useState<ResultadoImportacion | null>(null);
  const [errorImportacion, setErrorImportacion] = useState('');
  const grillaIngresoRef = useRef<HTMLDivElement | null>(null);
  const planillaDesplazadaRef = useRef('');
  const anioActual = hoy.getFullYear();
  const aniosDisponibles = Array.from(
    { length: Math.max(anioActual + 1, anio) - 2023 },
    (_, indice) => Math.max(anioActual + 1, anio) - indice
  );

  function limpiarPlanillaAbierta() {
    setPlanilla(null);
    setFilas([]);
    setAbonos({});
    setPasteles({});
    setSaldoInicial(0);
    setCambiosPendientes(false);
  }

  function guardarBorradorActual() {
    if (!planilla || typeof window === 'undefined') return;

    const borrador: BorradorPlanilla = {
      filas,
      abonos,
      pasteles,
      saldoInicial,
      actualizadoEn: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(
        claveBorradorPlanilla(planilla.id),
        JSON.stringify(borrador)
      );
    } catch {
      // La advertencia al abandonar sigue protegiendo si no hay almacenamiento local.
    }
  }

  function cambiarContexto(accion: () => void) {
    if (cambiosPendientes) guardarBorradorActual();
    accion();
    limpiarPlanillaAbierta();
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
    const filtrados = clientes.filter(
      (cliente) => correspondeAlRepartidor(cliente.repartidor_nombre, repartidor)
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

    const [detallesRespuesta, abonosRespuesta] = await Promise.all([
      supabase
        .from('reparto_planilla_detalles')
        .select('*')
        .eq('planilla_id', planillaData.id),
      supabase
        .from('reparto_planilla_abonos')
        .select('*')
        .eq('planilla_id', planillaData.id),
    ]);

    if (detallesRespuesta.error || abonosRespuesta.error) {
      alert(
        detallesRespuesta.error?.message ||
          abonosRespuesta.error?.message ||
          'No se pudieron cargar los datos de la planilla.'
      );
      setCargando(false);
      return;
    }

    const detallesData = detallesRespuesta.data;
    const abonosData = abonosRespuesta.data;

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

    let observacionesOrden = planillaData.observaciones;
    if (ordenClientesGuardado(observacionesOrden).length === 0) {
      const { data: plantillasOrden } = await supabase
        .from('reparto_planillas')
        .select('observaciones')
        .eq('empresa_id', perfil.empresa_id)
        .eq('repartidor_nombre', repartidor.trim())
        .not('observaciones', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(24);

      observacionesOrden =
        (plantillasOrden || []).find(
          (item) => ordenClientesGuardado(item.observaciones).length > 0
        )?.observaciones || null;
    }

    const ordenGuardado = ordenClientesGuardado(observacionesOrden);
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

    const borrador = leerBorradorPlanilla(planillaData.id);
    setFilas(
      borrador
        ? reconciliarFilasBorrador(filasCargadas, borrador.filas)
        : filasCargadas
    );
    setAbonos(borrador?.abonos || abonosPorDia);
    setPasteles(
      borrador?.pasteles || pastelesGuardados(planillaData.observaciones)
    );
    if (borrador) setSaldoInicial(Number(borrador.saldoInicial || 0));
    setCambiosPendientes(Boolean(borrador));
    setCargando(false);
  }

  useEffect(() => {
    if (!perfil || !repartidor.trim()) return;
    void abrirPlanilla();
  }, [perfil, anio, mes, repartidor, repartidorId, clientes]);

  useEffect(() => {
    if (
      !planilla ||
      cargando ||
      vistaPlanilla !== 'ingreso' ||
      filas.length === 0
    ) {
      return;
    }

    const clave = `${planilla.id}-${anio}-${mes}`;
    if (planillaDesplazadaRef.current === clave) return;

    const diasConDatos = filas.flatMap((fila) =>
      Object.entries(fila.dias)
        .filter(([, valores]) =>
          Boolean(valores.vendidos || valores.devueltos || valores.ajuste)
        )
        .map(([dia]) => Number(dia))
    );
    const ultimoDiaIngresado = diasConDatos.length
      ? Math.max(...diasConDatos)
      : 0;
    const diaDestino = Math.min(
      ultimoDiaIngresado > 0 ? ultimoDiaIngresado + 1 : 1,
      diasDelMes(anio, mes)
    );

    planillaDesplazadaRef.current = clave;
    const timeout = window.setTimeout(() => {
      const contenedor = grillaIngresoRef.current;
      if (!contenedor) return;

      const anchoColumnasFijas = 242;
      const anchoDia = 128;
      contenedor.scrollLeft = Math.max(
        0,
        anchoColumnasFijas + (diaDestino - 1) * anchoDia -
          anchoColumnasFijas
      );

      const entrada = contenedor.querySelector<HTMLInputElement>(
        `input[data-columna="${diaDestino}-vendidos"]`
      );
      entrada?.focus({ preventScroll: true });
      entrada?.select();
    }, 100);

    return () => window.clearTimeout(timeout);
  }, [anio, cargando, filas, mes, planilla, vistaPlanilla]);

  useEffect(() => {
    if (
      !planilla ||
      cargando ||
      !cambiosPendientes ||
      typeof window === 'undefined'
    ) {
      return;
    }

    const borrador: BorradorPlanilla = {
      filas,
      abonos,
      pasteles,
      saldoInicial,
      actualizadoEn: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(
        claveBorradorPlanilla(planilla.id),
        JSON.stringify(borrador)
      );
    } catch {
      // La planilla sigue operativa aunque el navegador no permita almacenamiento local.
    }
  }, [
    abonos,
    cambiosPendientes,
    cargando,
    filas,
    pasteles,
    planilla,
    saldoInicial,
  ]);

  useEffect(() => {
    if (!cambiosPendientes) return;

    function advertirCierre(event: BeforeUnloadEvent) {
      guardarBorradorActual();
      event.preventDefault();
      event.returnValue = '';
    }

    function advertirNavegacion(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const enlace = (event.target as Element | null)?.closest('a[href]');
      if (!enlace || enlace.getAttribute('target') === '_blank') return;

      const destino = new URL(enlace.getAttribute('href') || '', window.location.href);
      if (destino.href === window.location.href) return;

      guardarBorradorActual();
      const salir = window.confirm(
        'Hay cambios pendientes sin guardar en la base de datos. El borrador quedó respaldado solo en este equipo. ¿Quieres salir de Repartos?'
      );
      if (!salir) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener('beforeunload', advertirCierre);
    document.addEventListener('click', advertirNavegacion, true);
    return () => {
      window.removeEventListener('beforeunload', advertirCierre);
      document.removeEventListener('click', advertirNavegacion, true);
    };
  }, [abonos, cambiosPendientes, filas, pasteles, planilla, saldoInicial]);

  function actualizarCelda(
    filaKey: string,
    dia: number,
    campo: 'vendidos' | 'devueltos' | 'ajuste',
    valor: string
  ) {
    setCambiosPendientes(true);
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
    setCambiosPendientes(true);
    setFilas((actuales) =>
      actuales.map((fila) =>
        fila.key === filaKey ? { ...fila, precio: numero(valor) } : fila
      )
    );
  }

  async function moverFila(filaKey: string, direccion: -1 | 1) {
    if (!planilla || guardandoOrden) return;

    const indice = filas.findIndex((fila) => fila.key === filaKey);
    const destino = indice + direccion;
    if (indice < 0 || destino < 0 || destino >= filas.length) return;

    const ordenAnterior = filas;
    const siguientes = [...filas];
    [siguientes[indice], siguientes[destino]] = [
      siguientes[destino],
      siguientes[indice],
    ];

    setFilas(siguientes);
    setGuardandoOrden(true);
    const { error } = await supabase
      .from('reparto_planillas')
      .update({
        observaciones: observacionesPlanilla(
          siguientes.map((fila) => fila.key),
          pasteles
        ),
      })
      .eq('id', planilla.id);
    setGuardandoOrden(false);

    if (error) {
      setFilas(ordenAnterior);
      alert(`No se pudo guardar el nuevo orden: ${error.message}`);
    }
  }

  async function replicarOrdenEnTodosLosMeses() {
    if (!perfil || !planilla || !repartidor.trim() || filas.length === 0) return;

    setReplicandoOrden(true);
    const { data: planillasRepartidor, error: errorCarga } = await supabase
      .from('reparto_planillas')
      .select('id,observaciones')
      .eq('empresa_id', perfil.empresa_id)
      .eq('repartidor_nombre', repartidor.trim());

    const resultados = errorCarga
      ? []
      : await Promise.all(
          (planillasRepartidor || []).map((item) =>
            supabase
              .from('reparto_planillas')
              .update({
                observaciones: observacionesPlanilla(
                  filas.map((fila) => fila.key),
                  pastelesGuardados(item.observaciones)
                ),
              })
              .eq('id', item.id)
          )
        );
    const error = errorCarga || resultados.find((resultado) => resultado.error)?.error;
    setReplicandoOrden(false);

    if (error) {
      alert(`No se pudo replicar el orden: ${error.message}`);
      return;
    }

    const observacionesActuales = observacionesPlanilla(
      filas.map((fila) => fila.key),
      pasteles
    );
    setPlanilla((actual) =>
      actual ? { ...actual, observaciones: observacionesActuales } : actual
    );
    alert(
      'Orden aplicado a todos los meses existentes. Los meses nuevos heredaran este mismo orden.'
    );
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
        observaciones: observacionesPlanilla(
          filas.map((fila) => fila.key),
          pasteles
        ),
      })
      .eq('id', planilla.id);

    if (errorPlanilla) {
      alert(errorPlanilla.message);
      setGuardando(false);
      return;
    }

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

    const [detallesExistentesRespuesta, abonosExistentesRespuesta] =
      await Promise.all([
        supabase
          .from('reparto_planilla_detalles')
          .select('id,cliente_sigla,fecha')
          .eq('planilla_id', planilla.id),
        supabase
          .from('reparto_planilla_abonos')
          .select('id,fecha')
          .eq('planilla_id', planilla.id),
      ]);

    if (detallesExistentesRespuesta.error || abonosExistentesRespuesta.error) {
      alert(
        detallesExistentesRespuesta.error?.message ||
          abonosExistentesRespuesta.error?.message ||
          'No se pudo verificar la planilla antes de guardar.'
      );
      setGuardando(false);
      return;
    }

    if (detalles.length > 0) {
      const { error } = await supabase
        .from('reparto_planilla_detalles')
        .upsert(detalles, {
          onConflict: 'planilla_id,cliente_sigla,fecha',
        });
      if (error) {
        alert(`No se guardó la planilla. Tus datos siguen visibles: ${error.message}`);
        setGuardando(false);
        return;
      }
    }

    if (abonosGuardar.length > 0) {
      const { error } = await supabase
        .from('reparto_planilla_abonos')
        .upsert(abonosGuardar, { onConflict: 'planilla_id,fecha' });
      if (error) {
        alert(`No se guardaron los abonos. Los datos anteriores se conservaron: ${error.message}`);
        setGuardando(false);
        return;
      }
    }

    const clavesDetalles = new Set(
      detalles.map((detalle) => `${detalle.cliente_sigla}|${detalle.fecha}`)
    );
    const detallesAEliminar = (detallesExistentesRespuesta.data || [])
      .filter(
        (detalle) =>
          !clavesDetalles.has(`${detalle.cliente_sigla}|${detalle.fecha}`)
      )
      .map((detalle) => detalle.id);

    const fechasAbonos = new Set(abonosGuardar.map((abono) => abono.fecha));
    const abonosAEliminar = (abonosExistentesRespuesta.data || [])
      .filter((abono) => !fechasAbonos.has(abono.fecha))
      .map((abono) => abono.id);

    if (detallesAEliminar.length > 0) {
      const { error } = await supabase
        .from('reparto_planilla_detalles')
        .delete()
        .in('id', detallesAEliminar);
      if (error) {
        alert(`La planilla se guardó, pero no se pudieron limpiar filas antiguas: ${error.message}`);
        setGuardando(false);
        return;
      }
    }

    if (abonosAEliminar.length > 0) {
      const { error } = await supabase
        .from('reparto_planilla_abonos')
        .delete()
        .in('id', abonosAEliminar);
      if (error) {
        alert(`La planilla se guardó, pero no se pudieron limpiar abonos antiguos: ${error.message}`);
        setGuardando(false);
        return;
      }
    }

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(claveBorradorPlanilla(planilla.id));
    }
    setCambiosPendientes(false);
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

  function analizarImportacion() {
    setErrorImportacion('');
    setResultadoImportacion(null);
    if (!planilla) {
      setErrorImportacion('La planilla del reparto todavía no está cargada.');
      return;
    }
    if (filas.length === 0) {
      setErrorImportacion('Este reparto no tiene clientes disponibles para importar.');
      return;
    }

    const lineas = textoImportacion
      .split(/\r?\n/)
      .map((linea) => linea.split('\t'))
      .filter((celdas) => celdas.some((celda) => celda.trim()));
    const cantidadColumnasDias = dias.length * 2;
    const filasImportables = lineas
      .filter((celdas) => {
        const noVacios = celdas.map((celda) => celda.trim()).filter(Boolean);
        const esEncabezadoDias =
          noVacios.length >= dias.length &&
          noVacios.slice(0, dias.length).every(
            (valor, indice) => Number(valor) === dias[indice]
          );
        return (
          !esEncabezadoDias &&
          !noVacios.every((valor) => valor.toUpperCase() === 'K')
        );
      })
      .map((celdas) => {
        // Las dos primeras columnas son Cliente y Precio. Aunque el archivo
        // venga recortado al final o mantenga 31 días, se toman desde el día 1.
        const primeraCelda = celdas[0]?.trim() || '';
        const segundaCelda = celdas[1]?.trim() || '';
        const tieneNombreYPrecio =
          Boolean(primeraCelda) &&
          !/^-?\d+(?:[.,]\d+)?$/.test(primeraCelda) &&
          /^\d+(?:[.,]\d+)?$/.test(segundaCelda);
        const tieneDosColumnasVacias = !primeraCelda && !segundaCelda;
        const tieneColumnasCliente =
          celdas.length >= cantidadColumnasDias + 2 ||
          tieneNombreYPrecio ||
          tieneDosColumnasVacias;
        const esFilaCliente =
          tieneColumnasCliente &&
          Boolean(
            primeraCelda || /^\d+(?:[.,]\d+)?$/.test(segundaCelda)
          );
        if (tieneColumnasCliente) {
          const valores = celdas.slice(2, 2 + cantidadColumnasDias);
          while (valores.length < cantidadColumnasDias) valores.push('');
          return {
            valores,
            esFilaCliente,
            nombre: primeraCelda,
            precio: numero(segundaCelda),
          };
        }
        const valores = celdas.slice(0, cantidadColumnasDias);
        while (valores.length < cantidadColumnasDias) valores.push('');
        return {
          valores,
          esFilaCliente: false,
          nombre: '',
          precio: 0,
        };
      })
      .filter(
        ({ valores: celdas, esFilaCliente }) => {
          const valores = celdas.map((celda) => celda.trim());
          const noVacios = valores.filter(Boolean);
          return (
            celdas.length === cantidadColumnasDias &&
            (esFilaCliente ||
              valores.some((valor) => /^-?\d+(?:[.,]\d+)?$/.test(valor))) &&
            !noVacios.every((valor) => valor.toUpperCase() === 'K')
          );
        }
      );
    const filasNumericas = filasImportables.map(({ valores }) => valores);

    if (filasNumericas.length === 0) {
      setErrorImportacion(
        'No se reconocieron filas de clientes. Copia desde la columna Cliente hasta el último día.'
      );
      return;
    }

    // Excel suele incluir al final una fila de totales. Se reconoce comparando
    // sus columnas con la suma de las filas anteriores y nunca se asigna a un cliente.
    const ultimaFila = filasNumericas.at(-1);
    const filasAnteriores = filasNumericas.slice(0, -1);
    const coincidenciasTotal = ultimaFila
      ? ultimaFila.reduce((coincidencias, valor, indice) => {
          const totalAnterior = filasAnteriores.reduce(
            (suma, fila) => suma + numero(fila[indice]),
            0
          );
          const valorTotal = numero(valor);
          return coincidencias +
            (valor.trim() && Math.abs(valorTotal - totalAnterior) < 0.001 ? 1 : 0);
        }, 0)
      : 0;
    const columnasTotalConValor = ultimaFila?.filter((valor) => valor.trim()).length || 0;
    const tieneFilaTotal =
      filasAnteriores.length > 0 &&
      columnasTotalConValor > 0 &&
      coincidenciasTotal >= Math.max(3, Math.ceil(columnasTotalConValor * 0.6));
    const datosClientes = tieneFilaTotal
      ? filasImportables.slice(0, -1)
      : filasImportables;
    const siguientes = filas.map((fila) => ({ ...fila, dias: {} }));
    const indicesUtilizados = new Set<number>();

    datosClientes.forEach((origen, indiceOrigen) => {
      const nombreOrigen = normalizarNombre(origen.nombre);
      let indiceDestino = nombreOrigen
        ? siguientes.findIndex(
            (fila, indice) =>
              !indicesUtilizados.has(indice) &&
              [fila.sigla, fila.nombre].some(
                (nombre) => normalizarNombre(nombre) === nombreOrigen
              )
          )
        : -1;

      if (indiceDestino < 0 && origen.precio > 0) {
        indiceDestino = siguientes.findIndex(
          (fila, indice) =>
            !indicesUtilizados.has(indice) && fila.precio === origen.precio
        );
      }
      if (indiceDestino < 0 && origen.precio > 0) {
        indiceDestino = siguientes.findIndex(
          (fila) => fila.precio === origen.precio
        );
      }
      if (indiceDestino < 0) {
        indiceDestino = Math.min(indiceOrigen, siguientes.length - 1);
      }
      if (indiceDestino < 0) return;

      indicesUtilizados.add(indiceDestino);
      const destino = siguientes[indiceDestino];
      dias.forEach((dia, indiceDia) => {
        const anterior = destino.dias[dia] || {
          vendidos: 0,
          devueltos: 0,
          ajuste: 0,
        };
        destino.dias[dia] = {
          vendidos: anterior.vendidos + kilos(origen.valores[indiceDia * 2]),
          devueltos:
            anterior.devueltos + kilos(origen.valores[indiceDia * 2 + 1]),
          ajuste: anterior.ajuste,
        };
      });
    });
    const diasConDatos = dias.filter((dia) =>
      siguientes.some(
        (fila) => fila.dias[dia]?.vendidos || fila.dias[dia]?.devueltos
      )
    ).length;
    const kilosVendidos = siguientes.reduce(
      (total, fila) =>
        total + dias.reduce((subtotal, dia) => subtotal + fila.dias[dia].vendidos, 0),
      0
    );
    const kilosDevueltos = siguientes.reduce(
      (total, fila) =>
        total + dias.reduce((subtotal, dia) => subtotal + fila.dias[dia].devueltos, 0),
      0
    );
    setResultadoImportacion({
      filas: siguientes,
      filasLeidas: datosClientes.length,
      clientesSinDatos: Math.max(0, filas.length - indicesUtilizados.size),
      diasConDatos,
      kilosVendidos,
      kilosDevueltos,
    });
    setErrorImportacion('');
  }

  function aplicarImportacion() {
    if (!resultadoImportacion) return;
    const hayDatos = filas.some((fila) =>
      dias.some(
        (dia) =>
          fila.dias[dia]?.vendidos ||
          fila.dias[dia]?.devueltos ||
          fila.dias[dia]?.ajuste
      )
    );
    if (
      hayDatos &&
      !window.confirm(
        `Esta accion reemplazara las casillas visibles de ${nombreMes(mes)} ${anio}. ¿Continuar?`
      )
    ) {
      return;
    }
    setFilas(resultadoImportacion.filas);
    setCambiosPendientes(true);
    setMostrarImportador(false);
    setTextoImportacion('');
    setResultadoImportacion(null);
  }

  const totalesDiarios = useMemo(() => {
    let saldoAnterior = saldoInicial;

    return dias.map((dia) => {
      const kilosDia = totalDia(dia, 'vendidos');
      const venta = totalDia(dia, 'monto');
      const cacho = totalDia(dia, 'devolucion');
      const pastelesDia = numero(pasteles[dia]);
      const ventaPan = venta - cacho;
      const precioPan = kilosDia > 0 ? ventaPan / kilosDia : 0;
      const total = ventaPan + pastelesDia;
      const subTotal = saldoAnterior + total;
      const entregado = numero(abonos[dia]);
      const saldo = subTotal - entregado;
      const resultado = {
        dia,
        venta,
        cacho,
        pasteles: pastelesDia,
        total,
        kilos: kilosDia,
        precioPan,
        saldoAnterior,
        subTotal,
        entregado,
        saldo,
      };
      saldoAnterior = saldo;
      return resultado;
    });
  }, [abonos, dias, filas, pasteles, saldoInicial]);

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

        <div
          className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-xs font-black ${
            cambiosPendientes
              ? 'bg-amber-100 text-amber-800'
              : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {cambiosPendientes
            ? 'Cambios pendientes · borrador en este equipo'
            : 'Guardado'}
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
                cambiarContexto(() => setMes(numeroMes));
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

      <section className="grid gap-3 rounded-lg border border-[#4B2818]/15 bg-white p-4 md:grid-cols-[120px_180px] md:items-end">
        <label className="grid gap-1 text-xs font-black text-[#4B2818]">
          Año
          <select
            value={anio}
            onChange={(e) => {
              const siguienteAnio = Number(e.target.value);
              cambiarContexto(() => setAnio(siguienteAnio));
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
          Saldo inicial
          <input
            type="number"
            value={saldoInicial || ''}
            onChange={(e) => {
              setCambiosPendientes(true);
              setSaldoInicial(numero(e.target.value));
            }}
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

      {mostrarImportador && (
        <section className="rounded-lg border-2 border-[#A51F2B]/25 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-[#2A1710]">
                Importar desde Excel
              </h2>
              <p className="mt-1 text-sm font-semibold text-[#4B2818]/65">
                Copia el rango completo y pegalo aqui. Las filas se asignaran en
                el mismo orden de los clientes visibles; los valores sin cliente
                conservaran el precio de esa fila.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMostrarImportador(false);
                setResultadoImportacion(null);
              }}
              className="rounded-md p-2 text-[#4B2818]/60 hover:bg-[#FFF3DF]"
              aria-label="Cerrar importador"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <textarea
            value={textoImportacion}
            onChange={(event) => {
              setTextoImportacion(event.target.value);
              setResultadoImportacion(null);
              setErrorImportacion('');
            }}
            placeholder="Pega aqui las filas copiadas desde Excel..."
            className="mt-4 min-h-40 w-full rounded-md border border-[#4B2818]/20 bg-[#FFFDF8] p-3 font-mono text-xs outline-none focus:border-[#A51F2B]"
          />
          {errorImportacion && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
              {errorImportacion}
            </div>
          )}
          {resultadoImportacion && (
            <div className="mt-3 grid gap-2 rounded-md bg-[#FFF3DF] p-3 text-sm font-bold text-[#4B2818] sm:grid-cols-4">
              <span>{resultadoImportacion.filasLeidas} filas importadas</span>
              {resultadoImportacion.clientesSinDatos > 0 && (
                <span className="text-amber-800">
                  {resultadoImportacion.clientesSinDatos} clientes actuales quedan vacíos
                </span>
              )}
              <span>{resultadoImportacion.diasConDatos} dias con datos</span>
              <span>{resultadoImportacion.kilosVendidos.toLocaleString('es-CL')} kg vendidos</span>
              <span>{resultadoImportacion.kilosDevueltos.toLocaleString('es-CL')} kg devueltos</span>
            </div>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                try {
                  analizarImportacion();
                } catch (error) {
                  setResultadoImportacion(null);
                  setErrorImportacion(
                    error instanceof Error
                      ? `No se pudieron revisar los datos: ${error.message}`
                      : 'No se pudieron revisar los datos pegados.'
                  );
                }
              }}
              disabled={!textoImportacion.trim()}
              className="h-10 rounded-md border border-[#A51F2B] px-4 text-sm font-black text-[#A51F2B] disabled:opacity-50"
            >
              Revisar datos
            </button>
            <button
              type="button"
              onClick={aplicarImportacion}
              disabled={!resultadoImportacion}
              className="h-10 rounded-md bg-[#A51F2B] px-4 text-sm font-black text-white disabled:opacity-50"
            >
              Cargar en la grilla
            </button>
          </div>
        </section>
      )}

      <section className={vistaPlanilla === 'ingreso' ? 'min-w-0' : 'hidden'}>
        {!planilla ? (
          <p className="p-8 text-center text-sm font-bold text-[#4B2818]/60">
            {cargando
              ? 'Cargando planilla...'
              : 'Selecciona un repartidor para registrar ventas y devoluciones.'}
          </p>
        ) : (
          <div ref={grillaIngresoRef} className="max-h-[620px] overflow-auto">
            <table
              className="table-fixed border-collapse text-xs"
              style={{ width: 170 + 72 + dias.length * 128 + 112 }}
            >
              <colgroup>
                <col style={{ width: 170 }} />
                <col style={{ width: 72 }} />
                {dias.flatMap((dia) => [
                  <col key={`${dia}-vendidos-col`} style={{ width: 64 }} />,
                  <col key={`${dia}-devueltos-col`} style={{ width: 64 }} />,
                ])}
                <col style={{ width: 112 }} />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[#2A1710] text-white">
                <tr>
                  <th
                    colSpan={2}
                    className="sticky left-0 z-20 w-[242px] min-w-[242px] max-w-[242px] bg-[#2A1710] px-2 py-2 text-left"
                  >
                    <span className="grid grid-cols-[1fr_auto_72px] items-center gap-2">
                      <span>Cliente</span>
                      <span className="text-center capitalize">
                        <span className="block">{mesesDelAnio[mes - 1]}</span>
                        <span className="block text-[10px] text-white/70">
                          {anio}
                        </span>
                      </span>
                      <span className="text-right">Precio</span>
                    </span>
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
                  <th className="sticky left-[170px] z-20 bg-[#2A1710]" />
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
                  <tr
                    key={fila.key}
                    className="group border-b border-[#4B2818]/10 hover:bg-[#FFF3DF]/45"
                  >
                    <td className="sticky left-0 z-[5] w-[170px] min-w-[170px] max-w-[170px] overflow-hidden bg-white px-2 py-1 font-black uppercase text-[#2A1710] transition-colors group-focus-within:bg-amber-200">
                      <div className="flex items-center gap-1">
                        <div className="no-print flex shrink-0 gap-0.5">
                          <button type="button" disabled={guardandoOrden || indice === 0} onClick={() => void moverFila(fila.key, -1)} title="Subir cliente" aria-label={`Subir ${fila.nombre}`} className="rounded border border-[#4B2818]/15 p-1 text-[#A51F2B] disabled:opacity-25"><ArrowUp className="h-3.5 w-3.5" /></button>
                          <button type="button" disabled={guardandoOrden || indice === filas.length - 1} onClick={() => void moverFila(fila.key, 1)} title="Bajar cliente" aria-label={`Bajar ${fila.nombre}`} className="rounded border border-[#4B2818]/15 p-1 text-[#A51F2B] disabled:opacity-25"><ArrowDown className="h-3.5 w-3.5" /></button>
                        </div>
                        <div className="min-w-0 leading-tight" title={fila.nombre}>
                          <span className="block truncate">{fila.sigla}</span>
                          {normalizarNombre(fila.sigla) !==
                            normalizarNombre(fila.nombre) && (
                            <span className="block truncate text-[9px] font-bold normal-case text-[#4B2818]/60">
                              {fila.nombre}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="sticky left-[170px] z-[5] w-[72px] min-w-[72px] max-w-[72px] bg-white px-1 py-1 transition-colors group-focus-within:bg-amber-200">
                      <input
                        type="number"
                        data-columna="precio"
                        value={fila.precio || ''}
                        onChange={(e) => actualizarPrecio(fila.key, e.target.value)}
                        onKeyDown={moverEnGrilla}
                        className="sin-spinner h-8 w-16 rounded border border-[#4B2818]/15 px-1 text-right font-bold group-focus-within:bg-amber-50"
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
                          <td key={`${fila.key}-${dia}-v`} className={`border-l border-[#4B2818]/10 px-1 py-1 transition-colors group-focus-within:!bg-amber-100 ${esDomingo(anio, mes, dia) ? 'bg-amber-100' : ''}`}>
                            <input
                              type="number"
                              min="0"
                              data-columna={`${dia}-vendidos`}
                              value={celda.vendidos || ''}
                              onChange={(e) =>
                                actualizarCelda(fila.key, dia, 'vendidos', e.target.value)
                              }
                              onKeyDown={moverEnGrilla}
                              className="sin-spinner h-8 w-14 rounded border border-[#4B2818]/15 px-1 text-right font-bold group-focus-within:bg-amber-50"
                            />
                          </td>
                          <td key={`${fila.key}-${dia}-d`} className={`px-1 py-1 transition-colors group-focus-within:!bg-amber-100 ${esDomingo(anio, mes, dia) ? 'bg-amber-100' : ''}`}>
                            <input
                              type="number"
                              min="0"
                              data-columna={`${dia}-devueltos`}
                              value={celda.devueltos || ''}
                              onChange={(e) =>
                                actualizarCelda(fila.key, dia, 'devueltos', e.target.value)
                              }
                              onKeyDown={moverEnGrilla}
                              className="sin-spinner h-8 w-14 rounded border border-red-200 bg-red-50 px-1 text-right font-bold text-red-800 group-focus-within:bg-amber-50"
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
                  <td className="sticky left-[170px] z-[5] bg-[#FFF3DF]" />
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
                  <td className="sticky left-[170px] z-[5] bg-white" />
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
                  <td className="sticky left-[170px] z-[5] bg-emerald-50" />
                  {dias.map((dia) => (
                    <>
                      <td key={`${dia}-ab`} className={`border-l border-[#4B2818]/10 px-1 py-1 ${esDomingo(anio, mes, dia) ? 'bg-amber-100' : ''}`} colSpan={2}>
                        <input
                          type="number"
                          data-columna={`${dia}-abono`}
                          value={abonos[dia] || ''}
                          onChange={(e) => {
                            setCambiosPendientes(true);
                            setAbonos((actual) => ({
                              ...actual,
                              [dia]: numero(e.target.value),
                            }));
                          }}
                          onKeyDown={moverEnGrilla}
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

      <section className={vistaPlanilla === 'totales' ? 'min-w-0' : 'hidden'}>
        {!planilla ? (
          <p className="p-8 text-center text-sm font-bold text-[#4B2818]/60">
            Selecciona un repartidor para consultar sus totales.
          </p>
        ) : (
          <div className="max-h-[620px] overflow-auto rounded-lg border border-[#4B2818]/15 bg-white">
            <table className="w-full min-w-[1200px] table-fixed border-collapse text-sm">
              <colgroup>
                <col style={{ width: 70 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 120 }} />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[#2A1710] text-white">
                <tr>
                  <th className="px-3 py-3 text-left">Día</th>
                  <th className="px-3 py-3 text-right">Venta</th>
                  <th className="px-3 py-3 text-right">Cacho</th>
                  <th className="px-3 py-3 text-right">Pasteles</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3 text-right">Kilos</th>
                  <th className="px-3 py-3 text-right">Precio/p.</th>
                  <th className="px-3 py-3 text-right">Saldo anterior</th>
                  <th className="px-3 py-3 text-right">Sub Total</th>
                  <th className="px-3 py-3 text-right">Entregado</th>
                  <th className="px-3 py-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#4B2818]/10">
                {totalesDiarios.map((item) => (
                  <tr
                    key={item.dia}
                    className={
                      esDomingo(anio, mes, item.dia)
                        ? 'bg-amber-100'
                        : 'hover:bg-[#FFF3DF]/45'
                    }
                  >
                    <td className="px-3 py-2 font-black">
                      {letraDiaSemana(anio, mes, item.dia)} {item.dia}
                    </td>
                    <td className="px-3 py-2 text-right font-black">
                      {dinero(item.venta)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-red-700">
                      {dinero(item.cacho)}
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        data-columna="totales-pasteles"
                        value={item.pasteles || ''}
                        onChange={(event) => {
                          setCambiosPendientes(true);
                          setPasteles((actuales) => ({
                            ...actuales,
                            [item.dia]: Math.max(0, numero(event.target.value)),
                          }));
                        }}
                        onKeyDown={moverEnGrilla}
                        className="sin-spinner ml-auto block h-9 w-24 rounded border border-[#4B2818]/15 bg-white px-2 text-right font-bold"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-black">
                      {dinero(item.total)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold">
                      {item.kilos.toLocaleString('es-CL', {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-2 text-right font-black text-[#A51F2B]">
                      {dinero(item.precioPan)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {dinero(item.saldoAnterior)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold">
                      {dinero(item.subTotal)}
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        data-columna="totales-entregado"
                        value={item.entregado || ''}
                        onChange={(event) => {
                          setCambiosPendientes(true);
                          setAbonos((actuales) => ({
                            ...actuales,
                            [item.dia]: Math.max(0, numero(event.target.value)),
                          }));
                        }}
                        onKeyDown={moverEnGrilla}
                        className="ml-auto block h-9 w-24 rounded border border-emerald-200 bg-emerald-50 px-2 text-right font-bold text-emerald-800"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-black">
                      {dinero(item.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <nav className="!mt-0 flex w-full gap-1 overflow-x-auto rounded-b-lg border border-t-0 border-[#4B2818]/20 bg-[#F2E3CC] p-2 shadow-sm">
        {funcionarios.flatMap((funcionario) => {
          const apellido = apellidoPestana(funcionario.nombre_completo);
          return (['ingreso', 'totales'] as const).map((vista) => {
            const activo =
              funcionario.nombre_completo === repartidor &&
              vistaPlanilla === vista;
            const etiqueta = vista === 'totales' ? `ARR_${apellido}` : apellido;

            return (
              <button
                key={`${funcionario.id}-${vista}`}
                type="button"
                onClick={() => {
                  if (activo) return;
                  if (funcionario.nombre_completo === repartidor) {
                    setVistaPlanilla(vista);
                    return;
                  }
                  cambiarContexto(() => {
                    setVistaPlanilla(vista);
                    setRepartidor(funcionario.nombre_completo);
                    setRepartidorId(funcionario.id);
                  });
                }}
                className={`min-w-[132px] shrink-0 rounded-md border px-4 py-2.5 text-xs font-black tracking-wide transition ${
                  activo
                    ? 'border-[#2A1710] bg-[#2A1710] text-white shadow-sm'
                    : 'border-[#4B2818]/15 bg-white text-[#4B2818] hover:border-[#A51F2B]/40 hover:bg-[#FFF9EF]'
                }`}
              >
                {etiqueta}
              </button>
            );
          });
        })}
      </nav>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            setMostrarImportador((actual) => !actual);
            setResultadoImportacion(null);
          }}
          disabled={guardando || cargando || !planilla || vistaPlanilla !== 'ingreso'}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#4B2818]/30 bg-white px-5 text-sm font-black text-[#4B2818] disabled:opacity-60"
        >
          <ClipboardPaste className="h-4 w-4" />
          Pegar desde Excel
        </button>
        <button
          type="button"
          onClick={replicarOrdenEnTodosLosMeses}
          disabled={replicandoOrden || guardando || cargando || !planilla}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#A51F2B] bg-white px-5 text-sm font-black text-[#A51F2B] disabled:opacity-60"
        >
          {replicandoOrden && <Loader2 className="h-4 w-4 animate-spin" />}
          Aplicar orden a todos los meses
        </button>
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
