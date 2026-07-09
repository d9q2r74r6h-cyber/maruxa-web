'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type WheelEvent,
} from 'react';
import { flushSync } from 'react-dom';
import {
  Calculator,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Wheat,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';
import {
  calcularFactorAmasado,
  calcularTurno,
  clasificarRinde,
  type DatosTurno,
} from '@/lib/planillas/planillas';

type CampoTurno = keyof Omit<DatosTurno, 'repartos'>;

type TurnoConfig = {
  id: string;
  nombre: string;
  orden: number;
  hora_inicio: string | null;
  hora_fin: string | null;
};

type Funcionario = {
  id: string;
  nombre_completo: string;
  cargo: string;
};

type Reparto = {
  id: string;
  nombre: string;
  kilos: number;
};

type InsumoPlanilla = {
  id: string;
  producto_id: number;
  nombre: string;
  unidad: string;
  cantidad: number;
};

type ProductoRinde = {
  id: number;
  nombre: string;
  unidad_base: string | null;
};

type ProductoTurno = {
  id: string;
  producto_id: number;
  nombre: string;
  kilos: number;
};

type ClientePlanilla = {
  id: string;
  razon_social: string;
  sigla: string | null;
  repartidor_nombre: string | null;
  activo: boolean;
};

type OtroTurno = {
  id: string;
  cliente_id: string | null;
  cliente_nombre: string;
  producto_id: number | null;
  producto_nombre: string;
  kilos: number;
};

type BorradorTurno = {
  responsable: string;
  quintal: number;
  panaderos: number;
  observaciones: string;
  turno: DatosTurno;
  panSobranteAnterior: number;
  repartos: Reparto[];
  productosTurno: ProductoTurno[];
  otrosTurno: OtroTurno[];
  insumos: InsumoPlanilla[];
};

type TurnoGuardado = {
  turno: number;
  quintal: number;
  amasado: number;
  panaderos: number;
  masa_ocupa: number;
  masa_queda: number;
  pan_racion: number;
  pan_meson: number;
  pan_sobra: number;
  cacho: number;
  otroskg: number;
  centeno: number;
  meson: number;
  kilos: number;
  rinde: number;
};

type ResumenDia = {
  turno: string | null;
  quintal_total: number;
  amasado_total: number;
  ajuste_masa: number;
  sacos_ajustados: number;
  masa_ocupada: number;
  masa_sobrante: number;
  kilos_producidos: number;
  rinde_por_saco: number;
  pan_racion: number;
  pan_meson: number;
  pan_sobra: number;
  cacho: number;
  merma: number;
  turnos: {
    turno: number;
    nombre: string;
    quintal: number;
    amasado: number;
    panaderos: number;
    masa_ocupa: number;
    masa_queda: number;
    kilos: number;
    rinde: number;
    reparto: number;
    otroskg: number;
    merma: number;
    cacho: number;
  }[];
};

type ResumenMensualDia = {
  fecha: string;
  planilla: {
    quintal1: number;
    quintal2: number;
    centeno: number;
    meson: number;
    quintal_total: number;
    amasado1: number;
    amasado2: number;
    amasado_total: number;
    masa_ocupada: number;
    masa_sobrante: number;
    kilos_producidos: number;
    rinde_por_saco: number;
    pan_racion: number;
    pan_sobra: number;
    cacho: number;
  };
  turnos: Record<
    number,
    {
      quintal: number;
      amasado: number;
      panaderos: number;
      masa_ocupa: number;
      masa_queda: number;
      pan_racion: number;
      pan_sobra: number;
      cacho: number;
      centeno: number;
      meson: number;
      kilos: number;
      rinde: number;
      reparto: number;
      repartos: Record<string, number>;
      otroskg: number;
      merma: number;
      insumos: Record<string, number>;
    }
  >;
  insumos: Record<string, number>;
  merma: number;
};

type CampoGrilla =
  | 'quintal'
  | 'amasado'
  | 'masaQueda'
  | 'masaOcupa'
  | 'panaderos'
  | 'panRacion'
  | 'cacho'
  | 'centeno'
  | 'meson'
  | 'reparto'
  | 'repartos'
  | 'productos'
  | 'productoTurno'
  | 'merma'
  | 'panSobrante'
  | 'insumo'
  | 'agregarInsumo';

const turnoInicial: DatosTurno = {
  amasado: 0,
  masaOcupa: 0,
  masaQueda: 0,
  panRacion: 0,
  panSobrante: 0,
  merma: 0,
  cacho: 0,
  centeno: 0,
  meson: 0,
  otroskg: 0,
};

const repartidoresPorDefecto = [
  'JUAN ALFREDO TAPIA NAVARRETE',
  'LUIS ALBORNOZ',
  'PANADERIA',
  'MESON',
];

const repartoMesonNombre = 'MESON';

function hoy() {
  const fecha = new Date();
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function horaCorta(hora: string | null) {
  return hora ? hora.slice(0, 5) : '--:--';
}

function fechaEnPalabras(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number);

  if (!anio || !mes || !dia) return '';

  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(anio, mes - 1, dia));
}

function rangoMes(fecha: string) {
  const [anio, mes] = fecha.split('-').map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();

  return {
    anio,
    mes,
    ultimoDia,
    inicio: `${anio}-${String(mes).padStart(2, '0')}-01`,
    fin: `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

function nombreMes(fecha: string) {
  const { anio, mes } = rangoMes(fecha);

  return new Intl.DateTimeFormat('es-CL', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(anio, mes - 1, 1));
}

function letraDiaSemana(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const letras = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  return letras[new Date(anio, mes - 1, dia).getDay()] || '';
}

function esDomingo(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia).getDay() === 0;
}

function kilosConProductosIncluidos(
  turno: {
    kilos?: number | null;
    pan_racion?: number | null;
    reparto?: number | null;
    otroskg?: number | null;
    merma?: number | null;
    cacho?: number | null;
  },
  panSobranteAnterior = 0
) {
  const kilosGuardados = Number(turno.kilos || 0);
  const productosRinde = Number(turno.otroskg || 0);

  if (productosRinde <= 0) return kilosGuardados;

  const kilosCalculados =
    Number(turno.pan_racion || 0) +
    Number(turno.reparto || 0) +
    productosRinde +
    Number(turno.merma || 0) -
    Number(turno.cacho || 0) -
    Number(panSobranteAnterior || 0);

  return Number(Math.max(kilosGuardados, kilosCalculados).toFixed(2));
}

function normalizar(texto: string | null | undefined) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function referenciaRepartidor(nombre: string) {
  const limpio = nombre.trim();
  if (!limpio) return '';
  if (normalizar(limpio) === normalizar(repartoMesonNombre)) {
    return repartoMesonNombre;
  }

  const partes = limpio.split(/\s+/);
  if (partes.length >= 4) return partes[partes.length - 2];
  if (partes.length >= 2) return partes[partes.length - 1];
  return limpio;
}

function asegurarRepartoMeson(repartos: Reparto[]) {
  if (
    repartos.some(
      (item) => normalizar(item.nombre) === normalizar(repartoMesonNombre)
    )
  ) {
    return repartos;
  }

  return [
    ...repartos,
    {
      id: 'base-meson',
      nombre: repartoMesonNombre,
      kilos: 0,
    },
  ];
}

function numeroDia(valor: number | null | undefined, decimales = 2) {
  return Number(valor || 0).toLocaleString('es-CL', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

function turnoDesdeDetalle(nombre: string) {
  const encontrado = nombre.match(/\[turno:(\d+)\]/i);
  return encontrado ? Number(encontrado[1] || 0) : 0;
}

function esErrorColumnaPanaderos(error: { message?: string } | null) {
  return Boolean(
    error?.message?.toLowerCase().includes('panaderos') &&
      error.message.toLowerCase().includes('column')
  );
}

function colorRinde(estado: string) {
  if (estado === 'ideal') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (estado === 'aceptable') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  return 'border-red-200 bg-red-50 text-red-800';
}

function colorCeldaRinde(valor: number) {
  if (valor >= 64) return 'bg-emerald-100 text-emerald-900';
  if (valor >= 63) return 'bg-amber-100 text-amber-900';
  if (valor > 0) return 'bg-red-100 text-red-900';
  return '';
}

function evitarScrollCasillaNumero(event: WheelEvent<HTMLDivElement>) {
  const objetivo = event.target;

  if (objetivo instanceof HTMLInputElement && objetivo.type === 'number') {
    objetivo.blur();
  }
}

function CampoNumero({
  label,
  value,
  onChange,
  step = '0.01',
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold text-[#4B2818]">
      {label}
      <input
        type="number"
        min="0"
        step={step}
        value={value || ''}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="h-10 w-full rounded-md border border-[#4B2818]/20 bg-white px-3 text-right text-sm font-bold outline-none transition focus:border-[#A51F2B] focus:ring-2 focus:ring-[#A51F2B]/10"
      />
    </label>
  );
}

function CampoLinea({
  label,
  value,
  onChange,
  step = '0.01',
  className = '',
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: string;
  className?: string;
}) {
  return (
    <label
      className={`grid min-w-[92px] gap-1 border-r border-[#4B2818]/10 bg-white px-2 py-2 text-[10px] font-black uppercase text-[#4B2818]/65 ${className}`}
    >
      <span className="truncate" title={label}>
        {label}
      </span>
      <input
        type="number"
        min="0"
        step={step}
        value={value || ''}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="h-8 w-full rounded border border-[#4B2818]/20 bg-[#FFFDF8] px-2 text-right text-sm font-black text-[#2A1710] outline-none transition focus:border-[#A51F2B] focus:bg-white focus:ring-2 focus:ring-[#A51F2B]/10"
      />
    </label>
  );
}

function CeldaResultado({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`grid min-w-[102px] gap-1 border-r border-[#4B2818]/10 px-2 py-2 text-[10px] font-black uppercase ${
        emphasis
          ? 'bg-[#2A1710] text-white'
          : 'bg-[#FFF3DF] text-[#4B2818]/70'
      }`}
    >
      <span className="truncate" title={label}>
        {label}
      </span>
      <span className="h-8 rounded border border-black/5 bg-white/80 px-2 py-1.5 text-right text-sm font-black text-[#2A1710]">
        {value}
      </span>
    </div>
  );
}

function moverConEnter(event: KeyboardEvent<HTMLDivElement>) {
  if (event.defaultPrevented) return;

  if (event.key !== 'Enter' || event.target instanceof HTMLTextAreaElement) {
    return;
  }

  const actual = event.target as HTMLElement;

  if (!actual.matches('input, select')) return;

  if (actual instanceof HTMLInputElement && actual.dataset.grillaFila) {
    const columna = actual.dataset.grillaColumna;
    const filaActual = Number(actual.dataset.grillaFila || 0);
    const direccion = event.shiftKey ? -1 : 1;
    const camposGrilla = Array.from(
      event.currentTarget.querySelectorAll<HTMLInputElement>(
        'input[data-grilla-fila][data-grilla-columna]:not([disabled])'
      )
    )
      .filter(
        (campo) =>
          campo.dataset.grillaColumna === columna && campo.offsetParent !== null
      )
      .sort(
        (a, b) =>
          Number(a.dataset.grillaFila || 0) - Number(b.dataset.grillaFila || 0)
      );
    const siguiente = camposGrilla.find((campo) => {
      const fila = Number(campo.dataset.grillaFila || 0);
      return direccion > 0 ? fila > filaActual : fila < filaActual;
    });
    const anterior =
      direccion < 0
        ? camposGrilla
            .filter(
              (campo) => Number(campo.dataset.grillaFila || 0) < filaActual
            )
            .at(-1)
        : null;
    const destino = direccion > 0 ? siguiente : anterior;

    if (destino) {
      event.preventDefault();
      destino.focus();
      destino.select();
      return;
    }

    event.preventDefault();
    return;
  }

  const campos = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
    )
  ).filter(
    (campo) =>
      campo.tabIndex !== -1 &&
      campo.getAttribute('type') !== 'hidden' &&
      campo.offsetParent !== null
  );
  const posicionActual = campos.indexOf(actual);
  const siguientePosicion = event.shiftKey
    ? posicionActual - 1
    : posicionActual + 1;
  const siguiente = campos[siguientePosicion];

  if (!siguiente) return;

  event.preventDefault();
  siguiente.focus();

  if (siguiente instanceof HTMLInputElement) {
    siguiente.select();
  }
}

export default function AdminPlanillasPage() {
  const [fecha, setFecha] = useState(hoy);
  const [turnosConfigurados, setTurnosConfigurados] = useState<TurnoConfig[]>([]);
  const [turnoSeleccionadoId, setTurnoSeleccionadoId] = useState('');
  const [cargandoTurnos, setCargandoTurnos] = useState(true);
  const [mayordomos, setMayordomos] = useState<Funcionario[]>([]);
  const [repartidoresConfigurados, setRepartidoresConfigurados] = useState<
    Funcionario[]
  >([]);
  const [productosRinde, setProductosRinde] = useState<ProductoRinde[]>([]);
  const [productosPanaderia, setProductosPanaderia] = useState<ProductoRinde[]>(
    []
  );
  const [productosFamiliaPan, setProductosFamiliaPan] = useState<
    ProductoRinde[]
  >([]);
  const [clientesPanaderia, setClientesPanaderia] = useState<ClientePlanilla[]>(
    []
  );
  const [productosTurno, setProductosTurno] = useState<ProductoTurno[]>([]);
  const [otrosTurno, setOtrosTurno] = useState<OtroTurno[]>([]);
  const [productoSeleccionadoId, setProductoSeleccionadoId] = useState('');
  const [otroClienteSeleccionadoId, setOtroClienteSeleccionadoId] = useState('');
  const [otroProductoSeleccionadoId, setOtroProductoSeleccionadoId] = useState('');
  const [harinaSeleccionadaId, setHarinaSeleccionadaId] = useState('');
  const [columnaEditable, setColumnaEditable] = useState(hoy);
  const [moduloProductosRindeAbierto, setModuloProductosRindeAbierto] =
    useState(false);
  const [moduloOtrosAbierto, setModuloOtrosAbierto] = useState(false);
  const [moduloInsumosAbierto, setModuloInsumosAbierto] = useState(false);
  const [turnoCargadoClave, setTurnoCargadoClave] = useState('');
  const [tablaFuncionariosDisponible, setTablaFuncionariosDisponible] =
    useState(false);
  const [responsable, setResponsable] = useState('');
  const [quintal, setQuintal] = useState(0);
  const [panaderos, setPanaderos] = useState(0);
  const [panaderosDisponible, setPanaderosDisponible] = useState(true);
  const [observaciones, setObservaciones] = useState('');
  const [turno, setTurno] = useState<DatosTurno>({ ...turnoInicial });
  const [panSobranteAnterior, setPanSobranteAnterior] = useState(0);
  const [repartos, setRepartos] = useState<Reparto[]>([
    { id: 'temporal-1', nombre: 'Reparto 1', kilos: 0 },
  ]);
  const [insumos, setInsumos] = useState<InsumoPlanilla[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [resumenDia, setResumenDia] = useState<ResumenDia | null>(null);
  const [resumenMensual, setResumenMensual] = useState<
    Record<string, ResumenMensualDia>
  >({});
  const borradoresTurno = useRef<Record<string, BorradorTurno>>({});
  const borradoresEditados = useRef<Set<string>>(new Set());
  const cargaTurnoId = useRef(0);
  const [focoGrillaPendiente, setFocoGrillaPendiente] = useState<{
    dia: number;
    fila: number;
  } | null>(null);
  const [celdaEditable, setCeldaEditable] = useState<{
    dia: number;
    fila: number;
  } | null>(null);
  const turnoSeleccionado =
    turnosConfigurados.find((item) => item.id === turnoSeleccionadoId) || null;

  async function cargarResumenMensual(fechaSeleccionada = fecha) {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return;

    const { inicio, fin } = rangoMes(fechaSeleccionada);

    const { data: planillasData, error } = await supabase
      .from('planillas')
      .select(
        'id,fecha,turno,quintal1,quintal2,centeno,meson,quintal_total,amasado1,amasado2,amasado_total,masa_ocupada,masa_sobrante,kilos_producidos,rinde_por_saco,pan_racion,pan_sobra,cacho'
      )
      .eq('empresa_id', empresa.id)
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .order('fecha', { ascending: true });

    if (error) {
      setResumenMensual({});
      return;
    }

    const planillas = planillasData || [];
    const ids = planillas.map((item) => item.id);
    const turnosPorPlanilla = new Map<string, ResumenMensualDia['turnos']>();
    const mermaPorPlanilla = new Map<string, number>();
    const insumosPorPlanilla = new Map<string, Record<string, number>>();
    const detallesPorPlanillaTurno = new Map<
      string,
      {
        planillaId: string;
        turno: number;
        reparto: number;
        repartos: Record<string, number>;
        otroskg: number;
        merma: number;
      }
    >();

    if (ids.length > 0) {
      const { data: turnosData } = await supabase
        .from('planilla_turnos')
        .select(
          'id,planilla_id,turno,quintal,amasado,panaderos,masa_ocupa,masa_queda,pan_racion,pan_sobra,cacho,centeno,meson,kilos,rinde,reparto,otroskg'
        )
        .in('planilla_id', ids);
      const turnoIdAPlanilla = new Map<string, string>();
      const turnoIdAOrden = new Map<string, number>();

      for (const item of turnosData || []) {
        const planillaId = String(item.planilla_id);
        const turnoId = String(item.id);
        const ordenTurno = Number(item.turno || 0);
        turnoIdAPlanilla.set(turnoId, planillaId);
        turnoIdAOrden.set(turnoId, ordenTurno);
        const turnos = turnosPorPlanilla.get(planillaId) || {};
        turnos[ordenTurno] = {
          quintal: Number(item.quintal || 0),
          amasado: Number(item.amasado || 0),
          panaderos: Number(item.panaderos || 0),
          masa_ocupa: Number(item.masa_ocupa || 0),
          masa_queda: Number(item.masa_queda || 0),
          pan_racion: Number(item.pan_racion || 0),
          pan_sobra: Number(item.pan_sobra || 0),
          cacho: Number(item.cacho || 0),
          centeno: Number(item.centeno || 0),
          meson: Number(item.meson || 0),
          kilos: Number(item.kilos || 0),
          rinde: Number(item.rinde || 0),
          reparto: Number(item.reparto || 0),
          repartos: {},
          otroskg: Number(item.otroskg || 0),
          merma: 0,
          insumos: {},
        };
        turnosPorPlanilla.set(planillaId, turnos);
      }

      turnosPorPlanilla.forEach((turnos) => {
        Object.keys(turnos)
          .map(Number)
          .sort((a, b) => a - b)
          .forEach((ordenTurno) => {
            const turnoResumen = turnos[ordenTurno];
            if (!turnoResumen) return;
            turnoResumen.kilos = kilosConProductosIncluidos(
              turnoResumen,
              turnos[ordenTurno - 1]?.pan_sobra || 0
            );
          });
      });

      const turnoIds = Array.from(turnoIdAPlanilla.keys());
      if (turnoIds.length > 0) {
        const { data: insumosData } = await supabase
          .from('planilla_insumos')
          .select('planilla_turno_id,nombre,cantidad')
          .in('planilla_turno_id', turnoIds);

        for (const item of insumosData || []) {
          const turnoId = String(item.planilla_turno_id);
          const planillaId = turnoIdAPlanilla.get(turnoId);
          if (!planillaId) continue;

          const insumosPlanilla = insumosPorPlanilla.get(planillaId) || {};
          const clave = normalizar(item.nombre);
          const ordenTurno = turnoIdAOrden.get(turnoId);
          const turnoResumen = ordenTurno
            ? turnosPorPlanilla.get(planillaId)?.[ordenTurno]
            : null;

          if (turnoResumen) {
            turnoResumen.insumos[clave] =
              (turnoResumen.insumos[clave] || 0) + Number(item.cantidad || 0);
          }

          insumosPlanilla[clave] =
            (insumosPlanilla[clave] || 0) + Number(item.cantidad || 0);
          insumosPorPlanilla.set(planillaId, insumosPlanilla);
        }
      }

      const { data: detallesData } = await supabase
        .from('planilla_detalles')
        .select('planilla_id,producto_id,nombre_producto,kilos_total,merma')
        .in('planilla_id', ids);

      for (const item of detallesData || []) {
        const planillaId = String(item.planilla_id);
        const ordenTurno = turnoDesdeDetalle(item.nombre_producto);
        const claveDetalle = `${planillaId}::${ordenTurno}`;
        const detalleTurno =
          detallesPorPlanillaTurno.get(claveDetalle) || {
            planillaId,
            turno: ordenTurno,
            reparto: 0,
            repartos: {},
            otroskg: 0,
            merma: 0,
          };
        const kilosDetalle = Number(item.kilos_total || 0);
        const esMerma = normalizar(item.nombre_producto).startsWith('merma');

        mermaPorPlanilla.set(
          planillaId,
          (mermaPorPlanilla.get(planillaId) || 0) + Number(item.merma || 0)
        );

        if (!ordenTurno) {
          continue;
        }

        if (esMerma) {
          detalleTurno.merma += Number(item.merma || 0);
        } else if (item.producto_id) {
          detalleTurno.otroskg += kilosDetalle;
        } else if (kilosDetalle > 0) {
          detalleTurno.reparto += kilosDetalle;

          let nombre = item.nombre_producto
            .replace(/\s*\[turno:\d+\]\s*$/i, '')
            .trim();
          const separadorTurno = nombre.lastIndexOf(' - ');
          if (separadorTurno > -1) {
            nombre = nombre.slice(0, separadorTurno).trim();
          }

          const clave = normalizar(referenciaRepartidor(nombre));
          detalleTurno.repartos[clave] =
            (detalleTurno.repartos[clave] || 0) + kilosDetalle;
        }

        detallesPorPlanillaTurno.set(claveDetalle, detalleTurno);
      }

      const aplicarDetallesTurnos = (
        planillaId: string,
        turnos: ResumenMensualDia['turnos']
      ) => {
        detallesPorPlanillaTurno.forEach((detalle) => {
          if (detalle.planillaId !== planillaId || !detalle.turno) return;
          const turnoResumen = turnos[detalle.turno];
          if (!turnoResumen) return;

          turnoResumen.reparto = detalle.reparto;
          turnoResumen.repartos = detalle.repartos;
          turnoResumen.otroskg = detalle.otroskg;
          turnoResumen.merma = detalle.merma;
        });
      };

      turnosPorPlanilla.forEach((turnos, planillaId) => {
        aplicarDetallesTurnos(planillaId, turnos);

        Object.keys(turnos)
          .map(Number)
          .sort((a, b) => a - b)
          .forEach((ordenTurno) => {
            const turnoResumen = turnos[ordenTurno];
            if (!turnoResumen) return;
            const kilos = kilosConProductosIncluidos(
              turnoResumen,
              turnos[ordenTurno - 1]?.pan_sobra || 0
            );
            const factor = calcularFactorAmasado(
              turnoResumen.amasado,
              turnoResumen.masa_ocupa,
              turnoResumen.masa_queda
            );
            turnoResumen.kilos = kilos;
            turnoResumen.rinde =
              factor > 0 ? Number((kilos / factor).toFixed(2)) : turnoResumen.rinde;
          });
      });
    }

    const mensual: Record<string, ResumenMensualDia> = {};
    for (const item of planillas) {
      const turnosResumen = turnosPorPlanilla.get(item.id) || {};
      const tieneTurnos = Object.keys(turnosResumen).length > 0;
      const turnosHistoricos = tieneTurnos ? turnosResumen : {};
      const textoTurno = normalizar(String(item.turno || ''));
      const usaPrimerTurno =
        Number(item.quintal1 || 0) > 0 ||
        Number(item.amasado1 || 0) > 0 ||
        textoTurno.includes('1') ||
        !textoTurno.includes('2');
      const usaSegundoTurno =
        Number(item.quintal2 || 0) > 0 ||
        Number(item.amasado2 || 0) > 0 ||
        textoTurno.includes('2');
      const crearTurnoHistorico = (orden: number) => ({
        quintal:
          orden === 1
            ? Number(item.quintal1 || 0)
            : Number(item.quintal2 || 0),
        amasado:
          orden === 1
            ? Number(item.amasado1 || 0)
            : Number(item.amasado2 || 0),
        panaderos: 0,
        masa_ocupa:
          orden === 2 || !usaSegundoTurno
            ? Number(item.masa_ocupada || 0)
            : 0,
        masa_queda:
          orden === 2 || !usaSegundoTurno
            ? Number(item.masa_sobrante || 0)
            : 0,
        pan_racion:
          orden === 2 || !usaSegundoTurno
            ? Number(item.pan_racion || 0)
            : 0,
        pan_sobra:
          orden === 2 || !usaSegundoTurno
            ? Number(item.pan_sobra || 0)
            : 0,
        cacho:
          orden === 2 || !usaSegundoTurno
            ? Number(item.cacho || 0)
            : 0,
        centeno: orden === 1 ? Number(item.centeno || 0) : 0,
        meson: orden === 1 ? Number(item.meson || 0) : 0,
        kilos:
          orden === 2 || !usaSegundoTurno
            ? Number(item.kilos_producidos || 0)
            : 0,
        rinde:
          orden === 2 || !usaSegundoTurno
            ? Number(item.rinde_por_saco || 0)
            : 0,
        reparto: 0,
        repartos: {},
        otroskg: 0,
        merma: 0,
        insumos: {},
      });

      if (!tieneTurnos) {
        if (usaPrimerTurno) {
          turnosHistoricos[1] = crearTurnoHistorico(1);
        }

        if (usaSegundoTurno) {
          turnosHistoricos[2] = crearTurnoHistorico(2);
        }
      }

      detallesPorPlanillaTurno.forEach((detalle) => {
        if (detalle.planillaId !== String(item.id) || !detalle.turno) return;
        if (!turnosHistoricos[detalle.turno]) {
          turnosHistoricos[detalle.turno] = crearTurnoHistorico(detalle.turno);
        }
      });

      const aplicarDetallesHistoricos = (
        turnos: ResumenMensualDia['turnos']
      ) => {
        detallesPorPlanillaTurno.forEach((detalle) => {
          if (detalle.planillaId !== String(item.id) || !detalle.turno) return;
          const turnoResumen = turnos[detalle.turno];
          if (!turnoResumen) return;

          turnoResumen.reparto = detalle.reparto;
          turnoResumen.repartos = detalle.repartos;
          turnoResumen.otroskg = detalle.otroskg;
          turnoResumen.merma = detalle.merma;
          const kilos = kilosConProductosIncluidos(
            turnoResumen,
            turnos[detalle.turno - 1]?.pan_sobra || 0
          );
          const factor = calcularFactorAmasado(
            turnoResumen.amasado,
            turnoResumen.masa_ocupa,
            turnoResumen.masa_queda
          );
          turnoResumen.kilos = kilos;
          turnoResumen.rinde =
            factor > 0 ? Number((kilos / factor).toFixed(2)) : turnoResumen.rinde;
        });
      };

      aplicarDetallesHistoricos(turnosHistoricos);

      const turnosDelDia = Object.values(turnosHistoricos);
      const kilosProducidosDia =
        turnosDelDia.length > 0
          ? turnosDelDia.reduce((total, turnoItem) => total + Number(turnoItem.kilos || 0), 0)
          : Number(item.kilos_producidos || 0);
      const factorDia =
        turnosDelDia.length > 0
          ? turnosDelDia.reduce(
              (total, turnoItem) =>
                total +
                calcularFactorAmasado(
                  turnoItem.amasado,
                  turnoItem.masa_ocupa,
                  turnoItem.masa_queda
                ),
              0
            )
          : 0;

      mensual[item.fecha] = {
        fecha: item.fecha,
        planilla: {
          quintal1: Number(item.quintal1 || 0),
          quintal2: Number(item.quintal2 || 0),
          centeno: Number(item.centeno || 0),
          meson: Number(item.meson || 0),
          quintal_total: Number(item.quintal_total || 0),
          amasado1: Number(item.amasado1 || 0),
          amasado2: Number(item.amasado2 || 0),
          amasado_total: Number(item.amasado_total || 0),
          masa_ocupada: Number(item.masa_ocupada || 0),
          masa_sobrante: Number(item.masa_sobrante || 0),
          kilos_producidos: kilosProducidosDia,
          rinde_por_saco:
            factorDia > 0
              ? Number((kilosProducidosDia / factorDia).toFixed(2))
              : Number(item.rinde_por_saco || 0),
          pan_racion: Number(item.pan_racion || 0),
          pan_sobra: Number(item.pan_sobra || 0),
          cacho: Number(item.cacho || 0),
        },
        turnos: turnosHistoricos,
        insumos: insumosPorPlanilla.get(item.id) || {},
        merma: mermaPorPlanilla.get(item.id) || 0,
      };
    }

    setResumenMensual(mensual);
  }

  async function cargarResumenDia(fechaSeleccionada = fecha) {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return;

    const { data, error } = await supabase
      .from('planillas')
      .select(
        'id,turno,quintal1,quintal2,quintal_total,amasado1,amasado2,amasado_total,masa_ocupada,masa_sobrante,kilos_producidos,rinde_por_saco,pan_racion,pan_meson,pan_sobra,cacho'
      )
      .eq('empresa_id', empresa.id)
      .eq('fecha', fechaSeleccionada)
      .maybeSingle();

    if (error) {
      setResumenDia(null);
      return;
    }

    if (!data) {
      setResumenDia(null);
      return;
    }

    let { data: turnosData, error: errorTurnos } = await supabase
      .from('planilla_turnos')
      .select('turno,quintal,amasado,panaderos,masa_ocupa,masa_queda,kilos,rinde,reparto,otroskg,cacho,pan_sobra')
      .eq('planilla_id', data.id)
      .order('turno', { ascending: true });

    if (esErrorColumnaPanaderos(errorTurnos)) {
      setPanaderosDisponible(false);
      const respuesta = await supabase
        .from('planilla_turnos')
        .select('turno,quintal,amasado,masa_ocupa,masa_queda,kilos,rinde,reparto,otroskg,cacho,pan_sobra')
        .eq('planilla_id', data.id)
        .order('turno', { ascending: true });
      turnosData = (respuesta.data || []).map((item) => ({
        ...item,
        panaderos: 0,
      }));
      errorTurnos = respuesta.error;
    }

    if (errorTurnos) {
      setResumenDia(null);
      return;
    }
    const { data: detallesData } = await supabase
      .from('planilla_detalles')
      .select('producto_id,nombre_producto,kilos_total,merma')
      .eq('planilla_id', data.id);

    const detallesPorTurnoDia = new Map<
      number,
      { reparto: number; otroskg: number; merma: number }
    >();
    for (const detalle of detallesData || []) {
      const numeroTurno = turnoDesdeDetalle(detalle.nombre_producto || '');
      if (!numeroTurno) continue;

      const actual =
        detallesPorTurnoDia.get(numeroTurno) || {
          reparto: 0,
          otroskg: 0,
          merma: 0,
        };

      if (normalizar(detalle.nombre_producto).startsWith('merma')) {
        actual.merma += Number(detalle.merma || 0);
      } else if (detalle.producto_id) {
        actual.otroskg += Number(detalle.kilos_total || 0);
      } else {
        actual.reparto += Number(detalle.kilos_total || 0);
      }

      detallesPorTurnoDia.set(numeroTurno, actual);
    }

    let turnosResumen = (turnosData || []).map((item) => {
      const detalleTurno =
        detallesPorTurnoDia.get(Number(item.turno || 0)) || null;

      return {
        turno: Number(item.turno || 0),
        nombre:
          turnosConfigurados.find((config) => config.orden === Number(item.turno))
            ?.nombre || `Turno ${item.turno}`,
        quintal: Number(item.quintal || 0),
        amasado: Number(item.amasado || 0),
        panaderos: Number(item.panaderos || 0),
        masa_ocupa: Number(item.masa_ocupa || 0),
        masa_queda: Number(item.masa_queda || 0),
        kilos: Number(item.kilos || 0),
        rinde: Number(item.rinde || 0),
        reparto: detalleTurno?.reparto ?? Number(item.reparto || 0),
        otroskg: detalleTurno?.otroskg ?? Number(item.otroskg || 0),
        merma: detalleTurno?.merma ?? 0,
        cacho: Number(item.cacho || 0),
        pan_sobra: Number(item.pan_sobra || 0),
      };
    });

    const textoTurnoDia = normalizar(String(data.turno || ''));
    const usaSegundoTurnoDia =
      Number(data.quintal2 || 0) > 0 ||
      Number(data.amasado2 || 0) > 0 ||
      textoTurnoDia.includes('2');

    detallesPorTurnoDia.forEach((detalleTurno, numeroTurno) => {
      const yaExiste = turnosResumen.some((item) => item.turno === numeroTurno);
      if (yaExiste) return;

      const amasado =
        numeroTurno === 1
          ? Number(data.amasado1 || 0)
          : numeroTurno === 2
            ? Number(data.amasado2 || 0)
            : 0;
      const usaDatosGenerales = numeroTurno === 2 || !usaSegundoTurnoDia;
      const masaOcupa = usaDatosGenerales ? Number(data.masa_ocupada || 0) : 0;
      const masaQueda = usaDatosGenerales ? Number(data.masa_sobrante || 0) : 0;
      const panRacion = usaDatosGenerales ? Number(data.pan_racion || 0) : 0;
      const panSobra = usaDatosGenerales ? Number(data.pan_sobra || 0) : 0;

      turnosResumen.push({
        turno: numeroTurno,
        nombre:
          turnosConfigurados.find((config) => config.orden === numeroTurno)
            ?.nombre || `Turno ${numeroTurno}`,
        quintal:
          numeroTurno === 1
            ? Number(data.quintal1 || 0)
            : numeroTurno === 2
              ? Number(data.quintal2 || 0)
              : 0,
        amasado,
        panaderos: 0,
        masa_ocupa: masaOcupa,
        masa_queda: masaQueda,
        kilos: 0,
        rinde: 0,
        reparto: detalleTurno.reparto,
        otroskg: detalleTurno.otroskg,
        merma: detalleTurno.merma,
        cacho: usaDatosGenerales ? Number(data.cacho || 0) : 0,
        pan_sobra: panSobra,
      });
    });

    turnosResumen = turnosResumen.sort((a, b) => a.turno - b.turno);

    turnosResumen = turnosResumen.map((item) => {
      const anterior = turnosResumen.find(
        (turnoItem) => turnoItem.turno === item.turno - 1
      );
      const kilos = kilosConProductosIncluidos(item, anterior?.pan_sobra || 0);
      const factor = calcularFactorAmasado(
        item.amasado,
        item.masa_ocupa,
        item.masa_queda
      );

      return {
        ...item,
        kilos,
        rinde: factor > 0 ? Number((kilos / factor).toFixed(2)) : item.rinde,
      };
    });

    if (turnosResumen.length === 0 && (detallesData || []).length > 0) {
      turnosResumen = Array.from(detallesPorTurnoDia.entries())
        .sort(([turnoA], [turnoB]) => turnoA - turnoB)
        .map(([numeroTurno, detalleTurno]) => {
          const amasado =
            numeroTurno === 1
              ? Number(data.amasado1 || 0)
              : numeroTurno === 2
                ? Number(data.amasado2 || 0)
                : 0;
          const masaOcupa =
            numeroTurno === 1 ? Number(data.masa_ocupada || 0) : 0;
          const masaQueda =
            numeroTurno === 1 ? Number(data.masa_sobrante || 0) : 0;
          const panRacion =
            numeroTurno === 1 ? Number(data.pan_racion || 0) : 0;
          const panSobranteAnterior =
            numeroTurno === 2 ? Number(data.pan_sobra || 0) : 0;
          const kilos =
            detalleTurno.reparto +
            detalleTurno.otroskg +
            detalleTurno.merma +
            panRacion -
            panSobranteAnterior;
          const factor = calcularFactorAmasado(amasado, masaOcupa, masaQueda);

          return {
            turno: numeroTurno,
            nombre:
              turnosConfigurados.find((config) => config.orden === numeroTurno)
                ?.nombre || `Turno ${numeroTurno}`,
            quintal:
              numeroTurno === 1
                ? Number(data.quintal1 || 0)
                : numeroTurno === 2
                  ? Number(data.quintal2 || 0)
                  : 0,
            amasado,
            panaderos: 0,
            masa_ocupa: masaOcupa,
            masa_queda: masaQueda,
            kilos: Number(kilos.toFixed(2)),
            rinde: factor > 0 ? Number((kilos / factor).toFixed(2)) : 0,
            reparto: detalleTurno.reparto,
            otroskg: detalleTurno.otroskg,
            merma: detalleTurno.merma,
            cacho: 0,
            pan_sobra: 0,
          };
        });
    }
    const sacosAjustadosTurnos = turnosResumen.reduce(
      (total, item) =>
        total + calcularFactorAmasado(item.amasado, item.masa_ocupa, item.masa_queda),
      0
    );
    const sacosAjustadosDia =
      sacosAjustadosTurnos > 0
        ? sacosAjustadosTurnos
        : calcularFactorAmasado(
            Number(data.amasado_total || 0),
            Number(data.masa_ocupada || 0),
            Number(data.masa_sobrante || 0)
          );
    const kilosDia =
      turnosResumen.length > 0
        ? turnosResumen.reduce((total, item) => total + Number(item.kilos || 0), 0)
        : Number(data.kilos_producidos || 0);

    setResumenDia({
      turno: data.turno,
      quintal_total: Number(data.quintal_total || 0),
      amasado_total: Number(data.amasado_total || 0),
      ajuste_masa:
        sacosAjustadosDia -
        Number(data.amasado_total || 0),
      sacos_ajustados: sacosAjustadosDia,
      masa_ocupada: Number(data.masa_ocupada || 0),
      masa_sobrante: Number(data.masa_sobrante || 0),
      kilos_producidos: kilosDia,
      rinde_por_saco:
        sacosAjustadosDia > 0
          ? Number((kilosDia / sacosAjustadosDia).toFixed(2))
          : Number(data.rinde_por_saco || 0),
      pan_racion: Number(data.pan_racion || 0),
      pan_meson: Number(data.pan_meson || 0),
      pan_sobra: Number(data.pan_sobra || 0),
      cacho: Number(data.cacho || 0),
      merma: (detallesData || []).reduce(
        (total, item) => total + Number(item.merma || 0),
        0
      ),
      turnos: turnosResumen,
    });
  }

  useEffect(() => {
    async function cargarConfiguracion() {
      setCargandoTurnos(true);
      const empresa = await obtenerEmpresaActual();

      if (!empresa) {
        alert('No se pudo identificar la empresa.');
        setCargandoTurnos(false);
        return;
      }

      const { data, error } = await supabase
        .from('turnos')
        .select('id, nombre, orden, hora_inicio, hora_fin')
        .eq('empresa_id', empresa.id)
        .eq('activo', true)
        .order('orden', { ascending: true });

      if (error) {
        alert(error.message);
        setCargandoTurnos(false);
        return;
      }

      const turnos = (data || []) as TurnoConfig[];
      setTurnosConfigurados(turnos);
      setTurnoSeleccionadoId(turnos[0]?.id || '');

      const { data: funcionariosData, error: funcionariosError } = await supabase
        .from('funcionarios')
        .select('id, nombre_completo, cargo')
        .eq('empresa_id', empresa.id)
        .eq('activo', true)
        .order('nombre_completo', { ascending: true });

      if (!funcionariosError) {
        const funcionarios = (funcionariosData || []) as Funcionario[];
        const mayordomosActivos = funcionarios.filter(
          (item) => item.cargo.toLowerCase() === 'mayordomo'
        );
        const repartidoresActivos = funcionarios.filter(
          (item) => item.cargo.toLowerCase() === 'repartidor'
        );

        setMayordomos(mayordomosActivos);
        setRepartidoresConfigurados(repartidoresActivos);
        setRepartos(
          repartidoresActivos.length > 0
            ? asegurarRepartoMeson(
                repartidoresActivos.map((item) => ({
                  id: item.id,
                  nombre: referenciaRepartidor(item.nombre_completo),
                  kilos: 0,
                }))
              )
            : asegurarRepartoMeson(
                repartidoresPorDefecto.map((nombre) => ({
                  id: `base-${normalizar(nombre)}`,
                  nombre: referenciaRepartidor(nombre),
                  kilos: 0,
                }))
              )
        );
        setTablaFuncionariosDisponible(true);
      } else {
        setMayordomos([]);
        setRepartidoresConfigurados([]);
        setRepartos([
          { id: 'temporal-1', nombre: 'Reparto 1', kilos: 0 },
        ]);
        setTablaFuncionariosDisponible(false);
      }

      const { data: productosData, error: productosError } = await supabase
        .from('productos')
        .select('id, nombre, unidad_base')
        .eq('empresa_id', empresa.id)
        .eq('activo', true)
        .eq('contabiliza_como_saco', true)
        .order('nombre', { ascending: true });

      if (productosError) {
        alert(productosError.message);
      } else {
        const productos = (productosData || []) as ProductoRinde[];
        setProductosRinde(productos);
        setInsumos(
          productos.map((producto) => ({
            id: String(producto.id),
            producto_id: producto.id,
            nombre: producto.nombre,
            unidad: producto.unidad_base || 'kg',
            cantidad: 0,
          }))
        );
      }

      const { data: productosPanaderiaData, error: productosPanaderiaError } =
        await supabase
          .from('productos')
          .select('id, nombre, unidad_base')
          .eq('empresa_id', empresa.id)
          .eq('activo', true)
          .eq('tipo_producto', 'producto')
          .eq('categoria', 'Panadería')
          .order('nombre', { ascending: true });

      if (productosPanaderiaError) {
        alert(productosPanaderiaError.message);
      } else {
        setProductosPanaderia((productosPanaderiaData || []) as ProductoRinde[]);
      }

      const { data: productosFamiliaPanData, error: productosFamiliaPanError } =
        await supabase
          .from('productos')
          .select(
            `
              id,
              nombre,
              unidad_base,
              familias_productos!inner (
                nombre
              )
            `
          )
          .eq('empresa_id', empresa.id)
          .eq('activo', true)
          .eq('tipo_producto', 'producto')
          .ilike('familias_productos.nombre', '%pan%')
          .order('nombre', { ascending: true });

      if (!productosFamiliaPanError) {
        setProductosFamiliaPan(
          (productosFamiliaPanData || []) as ProductoRinde[]
        );
      }

      const { data: clientesPanaderiaData, error: clientesPanaderiaError } =
        await supabase
          .from('clientes')
          .select('id,razon_social,sigla,repartidor_nombre,activo')
          .eq('empresa_id', empresa.id)
          .eq('activo', true)
          .ilike('repartidor_nombre', '%panader%')
          .order('razon_social', { ascending: true });

      if (!clientesPanaderiaError) {
        setClientesPanaderia((clientesPanaderiaData || []) as ClientePlanilla[]);
      }

      setCargandoTurnos(false);
      await cargarResumenDia();
      await cargarResumenMensual();
    }

    cargarConfiguracion();
  }, []);

  useEffect(() => {
    cargarResumenDia(fecha);
    cargarResumenMensual(fecha);
  }, [fecha, turnosConfigurados]);

  useEffect(() => {
    if (cargandoTurnos || !turnoSeleccionado) return;
    cargarTurnoGuardado(fecha, turnoSeleccionado);
  }, [
    cargandoTurnos,
    fecha,
    turnoSeleccionadoId,
    productosRinde,
    productosPanaderia,
    productosFamiliaPan,
    repartidoresConfigurados,
    tablaFuncionariosDisponible,
  ]);

  const kilosRepartos = useMemo(
    () => repartos.reduce((total, reparto) => total + reparto.kilos, 0),
    [repartos]
  );
  const kilosProductosTurno = useMemo(
    () => productosTurno.reduce((total, producto) => total + producto.kilos, 0),
    [productosTurno]
  );
  const kilosOtrosTurno = useMemo(
    () => otrosTurno.reduce((total, item) => total + Number(item.kilos || 0), 0),
    [otrosTurno]
  );

  const datosTurno = useMemo<DatosTurno>(
    () => ({
      ...turno,
      otroskg: kilosProductosTurno,
      panSobranteAnterior,
      repartos: repartos.map((reparto) => reparto.kilos),
    }),
    [kilosProductosTurno, panSobranteAnterior, repartos, turno]
  );

  const calculo = useMemo(() => calcularTurno(datosTurno), [datosTurno]);

  function claveBorrador(fechaClave: string, orden: number) {
    return `${fechaClave}::${orden}`;
  }

  function marcarTurnoActualComoCargado() {
    if (!turnoSeleccionado) return;
    const claveActual = claveBorrador(fecha, turnoSeleccionado.orden);
    borradoresEditados.current.add(claveActual);
    setTurnoCargadoClave(claveActual);
  }

  function guardarBorradorTurnoActual() {
    if (!turnoSeleccionado) return;
    const claveActual = claveBorrador(fecha, turnoSeleccionado.orden);
    if (turnoCargadoClave !== claveActual) return;

    borradoresTurno.current[claveActual] = {
      responsable,
      quintal,
      panaderos,
      observaciones,
      turno: { ...turno },
      panSobranteAnterior,
      repartos: repartos.map((item) => ({ ...item })),
      productosTurno: productosTurno.map((item) => ({ ...item })),
      otrosTurno: otrosTurno.map((item) => ({ ...item })),
      insumos: insumos.map((item) => ({ ...item })),
    };
  }

  function borradorTurnoConCambio(
    campo: CampoGrilla,
    valor: number,
    insumoId?: string,
    repartoId?: string,
    productoTurnoId?: string
  ): BorradorTurno {
    const turnoBorrador = { ...turno };
    let quintalBorrador = quintal;
    let panaderosBorrador = panaderos;
    let repartosBorrador = repartos.map((item) => ({ ...item }));
    let productosTurnoBorrador = productosTurno.map((item) => ({ ...item }));
    const otrosTurnoBorrador = otrosTurno.map((item) => ({ ...item }));
    let insumosBorrador = insumos.map((item) => ({ ...item }));

    if (campo === 'insumo') {
      insumosBorrador = insumosBorrador.map((item) =>
        item.id === insumoId ? { ...item, cantidad: valor } : item
      );
    }

    if (campo === 'reparto') {
      repartosBorrador = repartosBorrador.map((item) =>
        item.id === repartoId ? { ...item, kilos: valor } : item
      );
    }

    if (campo === 'productoTurno') {
      productosTurnoBorrador = productosTurnoBorrador.map((item) =>
        item.id === productoTurnoId ? { ...item, kilos: valor } : item
      );
    }

    if (campo === 'quintal') quintalBorrador = valor;
    if (campo === 'panaderos') panaderosBorrador = valor;
    if (campo === 'amasado') turnoBorrador.amasado = valor;
    if (campo === 'masaQueda') turnoBorrador.masaQueda = valor;
    if (campo === 'masaOcupa') turnoBorrador.masaOcupa = valor;
    if (campo === 'panRacion') turnoBorrador.panRacion = valor;
    if (campo === 'cacho') turnoBorrador.cacho = valor;
    if (campo === 'centeno') turnoBorrador.centeno = valor;
    if (campo === 'meson') turnoBorrador.meson = valor;
    if (campo === 'merma') turnoBorrador.merma = valor;
    if (campo === 'panSobrante') turnoBorrador.panSobrante = valor;

    if (campo === 'repartos') {
      const base = repartosBorrador.length > 0 ? repartosBorrador : repartosBase();
      const indiceDestino = Math.max(0, base.findIndex((item) => item.kilos > 0));
      repartosBorrador = base.map((item, indice) => ({
        ...item,
        kilos: indice === indiceDestino ? valor : 0,
      }));
    }

    if (campo === 'productos') {
      const base =
        productosTurnoBorrador.length > 0
          ? productosTurnoBorrador
          : productosTurnoBase();
      const indiceDestino = Math.max(0, base.findIndex((item) => item.kilos > 0));
      productosTurnoBorrador = base.map((item, indice) => ({
        ...item,
        kilos: indice === indiceDestino ? valor : 0,
      }));
    }

    return {
      responsable,
      quintal: quintalBorrador,
      panaderos: panaderosBorrador,
      observaciones,
      turno: turnoBorrador,
      panSobranteAnterior,
      repartos: repartosBorrador,
      productosTurno: productosTurnoBorrador,
      otrosTurno: otrosTurnoBorrador,
      insumos: insumosBorrador,
    };
  }

  function guardarBorradorTurnoConCambio(
    campo: CampoGrilla,
    valor: number,
    insumoId?: string,
    repartoId?: string,
    productoTurnoId?: string
  ) {
    if (!turnoSeleccionado) return;

    const claveActual = claveBorrador(fecha, turnoSeleccionado.orden);
    borradoresEditados.current.add(claveActual);
    borradoresTurno.current[claveActual] = borradorTurnoConCambio(
      campo,
      valor,
      insumoId,
      repartoId,
      productoTurnoId
    );
  }

  function restaurarBorradorTurno(borrador: BorradorTurno) {
    setResponsable(borrador.responsable);
    setQuintal(borrador.quintal);
    setPanaderos(borrador.panaderos);
    setObservaciones(borrador.observaciones);
    setTurno({ ...borrador.turno });
    setPanSobranteAnterior(borrador.panSobranteAnterior);
    setRepartos(borrador.repartos.map((item) => ({ ...item })));
    setProductosTurno(borrador.productosTurno.map((item) => ({ ...item })));
    setOtrosTurno((borrador.otrosTurno || []).map((item) => ({ ...item })));
    setInsumos(borrador.insumos.map((item) => ({ ...item })));
    setMensaje('');
  }

  function cambiarCampo(campo: CampoTurno, valor: number) {
    setTurno((actual) => ({ ...actual, [campo]: valor }));
  }

  function seleccionarTurnoPorOrden(orden: number, guardarActual = true) {
    const turnoConfig = turnosConfigurados.find((item) => item.orden === orden);
    if (!turnoConfig || turnoConfig.id === turnoSeleccionadoId) return;
    if (guardarActual) guardarBorradorTurnoActual();
    setTurnoCargadoClave('');
    setTurnoSeleccionadoId(turnoConfig.id);
  }

  function seleccionarCeldaGrilla(
    fechaCelda: string,
    orden?: number,
    guardarActual = true
  ) {
    if (fechaCelda !== fecha) {
      if (guardarActual) guardarBorradorTurnoActual();
      cargaTurnoId.current += 1;
      setTurnoCargadoClave('');
      setCeldaEditable(null);
      limpiarTurno();
      setFecha(fechaCelda);
    }

    if (orden) {
      seleccionarTurnoPorOrden(orden, guardarActual);
    }
  }

  function esFilaAccionGrilla(fila: FilaMensual) {
    return (
      !fila.editable ||
      fila.editable?.campo === 'agregarInsumo' ||
      fila.editable?.campo === 'productos' ||
      fila.editable?.campo === 'merma'
    );
  }

  function primeraFilaEditableGrilla() {
    return filasMensuales.findIndex((fila) => !esFilaAccionGrilla(fila));
  }

  function moverEnterGrilla(
    event: KeyboardEvent<HTMLInputElement>,
    fila: FilaMensual,
    indiceFila: number,
    dia: number
  ) {
    if (event.key !== 'Enter' || event.shiftKey || !fila.editable) {
      return;
    }

    const siguienteFila = filasMensuales.findIndex(
      (item, indice) =>
        indice > indiceFila &&
        item.editable &&
        !esFilaAccionGrilla(item)
    );

    if (siguienteFila === -1) return;

    const filaDestino = filasMensuales[siguienteFila];
    const ordenDestino = filaDestino.editable?.turno;

    event.preventDefault();
    event.stopPropagation();
    const valorActual = Number(event.currentTarget.value || 0);
    flushSync(() => {
      cambiarCampoGrilla(
        fila.editable!.campo,
        valorActual,
        fila.editable!.insumoId,
        fila.editable!.repartoId,
        fila.editable!.productoTurnoId
      );
    });
    guardarBorradorTurnoConCambio(
      fila.editable.campo,
      valorActual,
      fila.editable.insumoId,
      fila.editable.repartoId,
      fila.editable.productoTurnoId
    );
    setCeldaEditable({ dia, fila: siguienteFila });
    setFocoGrillaPendiente({ dia, fila: siguienteFila });
    seleccionarCeldaGrilla(fechaDiaMes(dia), ordenDestino, false);
  }

  function valorEditableGrilla(
    campo: CampoGrilla,
    insumoId?: string,
    repartoId?: string,
    productoTurnoId?: string
  ) {
    if (campo === 'insumo') {
      return (
        insumos.find((item) => item.id === insumoId)?.cantidad || 0
      );
    }

    if (campo === 'reparto') {
      return repartos.find((item) => item.id === repartoId)?.kilos || 0;
    }

    if (campo === 'productoTurno') {
      return productosTurno.find((item) => item.id === productoTurnoId)?.kilos || 0;
    }

    if (campo === 'quintal') return quintal;
    if (campo === 'panaderos') return panaderos;
    if (campo === 'amasado') return turno.amasado;
    if (campo === 'masaQueda') return turno.masaQueda;
    if (campo === 'masaOcupa') return turno.masaOcupa;
    if (campo === 'panRacion') return turno.panRacion;
    if (campo === 'cacho') return turno.cacho || 0;
    if (campo === 'centeno') return turno.centeno || 0;
    if (campo === 'meson') return turno.meson || 0;
    if (campo === 'repartos') return kilosRepartos;
    if (campo === 'productos') return kilosProductosTurno;
    if (campo === 'merma') return turno.merma || 0;
    if (campo === 'panSobrante') return turno.panSobrante || 0;
    return 0;
  }

  function cambiarTotalRepartosGrilla(valor: number) {
    setRepartos((actuales) => {
      const base = actuales.length > 0 ? actuales : repartosBase();
      const indiceDestino = Math.max(
        0,
        base.findIndex((item) => item.kilos > 0)
      );

      return base.map((item, indice) => ({
        ...item,
        kilos: indice === indiceDestino ? valor : 0,
      }));
    });
  }

  function cambiarRepartoGrilla(repartoId: string | undefined, valor: number) {
    if (!repartoId) return;
    setRepartos((actuales) =>
      actuales.map((item) =>
        item.id === repartoId ? { ...item, kilos: valor } : item
      )
    );
  }

  function cambiarTotalProductosGrilla(valor: number) {
    setProductosTurno((actuales) => {
      const base = actuales.length > 0 ? actuales : productosTurnoBase();
      const indiceDestino = Math.max(
        0,
        base.findIndex((item) => item.kilos > 0)
      );

      return base.map((item, indice) => ({
        ...item,
        kilos: indice === indiceDestino ? valor : 0,
      }));
    });
  }

  function cambiarCampoGrilla(
    campo: CampoGrilla,
    valor: number,
    insumoId?: string,
    repartoId?: string,
    productoTurnoId?: string
  ) {
    marcarTurnoActualComoCargado();

    if (campo === 'insumo') {
      const actualizados = insumos.map((item) =>
        item.id === insumoId ? { ...item, cantidad: valor } : item
      );
      setInsumos(actualizados);
      return;
    }

    if (campo === 'reparto') {
      cambiarRepartoGrilla(repartoId, valor);
      return;
    }

    if (campo === 'productoTurno') {
      setProductosTurno((actuales) =>
        actuales.map((item) =>
          item.id === productoTurnoId ? { ...item, kilos: valor } : item
        )
      );
      return;
    }

    if (campo === 'quintal') {
      setQuintal(valor);
      return;
    }

    if (campo === 'panaderos') {
      setPanaderos(valor);
      return;
    }

    if (campo === 'amasado') cambiarCampo('amasado', valor);
    if (campo === 'masaQueda') cambiarCampo('masaQueda', valor);
    if (campo === 'masaOcupa') cambiarCampo('masaOcupa', valor);
    if (campo === 'panRacion') cambiarCampo('panRacion', valor);
    if (campo === 'cacho') cambiarCampo('cacho', valor);
    if (campo === 'centeno') cambiarCampo('centeno', valor);
    if (campo === 'meson') cambiarCampo('meson', valor);
    if (campo === 'repartos') cambiarTotalRepartosGrilla(valor);
    if (campo === 'productos') cambiarTotalProductosGrilla(valor);
    if (campo === 'merma') cambiarCampo('merma', valor);
    if (campo === 'panSobrante') cambiarCampo('panSobrante', valor);
  }

  function repartosBase() {
    if (tablaFuncionariosDisponible && repartidoresConfigurados.length > 0) {
      return asegurarRepartoMeson(
        repartidoresConfigurados.map((item) => ({
          id: item.id,
          nombre: referenciaRepartidor(item.nombre_completo),
          kilos: 0,
        }))
      );
    }

    return asegurarRepartoMeson(
      repartidoresPorDefecto.map((nombre) => ({
        id: `base-${normalizar(nombre)}`,
        nombre: referenciaRepartidor(nombre),
        kilos: 0,
      }))
    );
  }

  function insumosBase() {
    return productosRinde.map((producto) => ({
      id: String(producto.id),
      producto_id: producto.id,
      nombre: producto.nombre,
      unidad: producto.unidad_base || 'kg',
      cantidad: 0,
    }));
  }

  function productosTurnoBase() {
    return productosPanaderia.map((producto) => ({
      id: String(producto.id),
      producto_id: producto.id,
      nombre: producto.nombre,
      kilos: 0,
    }));
  }

  function agregarHarinaGrilla() {
    const producto = productosRinde.find(
      (item) => String(item.id) === harinaSeleccionadaId
    );

    if (!producto) return;

    setInsumos((actuales) => {
      if (actuales.some((item) => item.producto_id === producto.id)) {
        return actuales;
      }

      return [
        ...actuales,
        {
          id: String(producto.id),
          producto_id: producto.id,
          nombre: producto.nombre,
          unidad: producto.unidad_base || 'kg',
          cantidad: 0,
        },
      ];
    });
    setHarinaSeleccionadaId('');
  }

  function agregarProductoTurno() {
    const producto = productosPanaderia.find(
      (item) => String(item.id) === productoSeleccionadoId
    );

    if (!producto) return;

    setProductosTurno((actuales) => {
      if (actuales.some((item) => item.producto_id === producto.id)) {
        return actuales;
      }

      return [
        ...actuales,
        {
          id: String(producto.id),
          producto_id: producto.id,
          nombre: producto.nombre,
          kilos: 0,
        },
      ];
    });
    marcarTurnoActualComoCargado();
    setProductoSeleccionadoId('');
  }

  function actualizarOtrosTurno(siguiente: OtroTurno[]) {
    setOtrosTurno(siguiente);
    cambiarCampo(
      'merma',
      siguiente.reduce((total, item) => total + Number(item.kilos || 0), 0)
    );
    marcarTurnoActualComoCargado();
  }

  function agregarOtroTurno() {
    const cliente = clientesPanaderia.find(
      (item) => item.id === otroClienteSeleccionadoId
    );
    const producto = productosFamiliaPan.find(
      (item) => String(item.id) === otroProductoSeleccionadoId
    );

    if (!cliente || !producto) return;

    actualizarOtrosTurno([
      ...otrosTurno,
      {
        id: `otro-${Date.now()}`,
        cliente_id: cliente.id,
        cliente_nombre: cliente.sigla || cliente.razon_social,
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        kilos: 0,
      },
    ]);
    setOtroClienteSeleccionadoId('');
    setOtroProductoSeleccionadoId('');
  }

  function abrirModuloProductosRinde(fechaCelda: string, orden?: number) {
    seleccionarCeldaGrilla(fechaCelda, orden);
    setModuloProductosRindeAbierto(true);
  }

  function abrirModuloOtros(fechaCelda: string, orden?: number) {
    seleccionarCeldaGrilla(fechaCelda, orden);
    setModuloOtrosAbierto(true);
  }

  function abrirModuloInsumos(fechaCelda: string) {
    seleccionarCeldaGrilla(fechaCelda);
    setModuloInsumosAbierto(true);
  }

  function limpiarTurno() {
    setResponsable('');
    setQuintal(0);
    setPanaderos(0);
    setObservaciones('');
    setTurno({ ...turnoInicial });
    setPanSobranteAnterior(0);
    setRepartos(repartosBase());
    setProductosTurno([]);
    setOtrosTurno([]);
    setProductoSeleccionadoId('');
    setOtroClienteSeleccionadoId('');
    setOtroProductoSeleccionadoId('');
    setHarinaSeleccionadaId('');
    setInsumos(insumosBase());
    setMensaje('');
  }

  async function cargarTurnoGuardado(
    fechaSeleccionada = fecha,
    turnoConfig = turnoSeleccionado
  ) {
    if (!turnoConfig) return;
    const idCarga = ++cargaTurnoId.current;
    const cargaVigente = () => idCarga === cargaTurnoId.current;

    const borrador = borradoresTurno.current[
      claveBorrador(fechaSeleccionada, turnoConfig.orden)
    ];
    if (borrador) {
      if (!cargaVigente()) return;
      restaurarBorradorTurno(borrador);
      setTurnoCargadoClave(claveBorrador(fechaSeleccionada, turnoConfig.orden));
      return;
    }

    const empresa = await obtenerEmpresaActual();
    if (!empresa || !cargaVigente()) return;

    const { data: planilla, error: errorPlanilla } = await supabase
      .from('planillas')
      .select(
        'id,turno,responsable,observaciones,quintal1,quintal2,centeno,meson,amasado1,amasado2,masa_ocupada,masa_sobrante,pan_racion,pan_meson,pan_sobra,cacho'
      )
      .eq('empresa_id', empresa.id)
      .eq('fecha', fechaSeleccionada)
      .maybeSingle();

    if (errorPlanilla || !planilla) {
      if (!cargaVigente()) return;
      limpiarTurno();
      setTurnoCargadoClave('');
      return;
    }

    let { data: turnoDb, error: errorTurno } = await supabase
      .from('planilla_turnos')
      .select(
        'id,responsable,quintal,amasado,panaderos,masa_ocupa,masa_queda,pan_racion,pan_meson,pan_sobra,cacho,centeno,meson,kilos,rinde'
      )
      .eq('planilla_id', planilla.id)
      .eq('turno', turnoConfig.orden)
      .maybeSingle();

    if (esErrorColumnaPanaderos(errorTurno)) {
      setPanaderosDisponible(false);
      const respuesta = await supabase
        .from('planilla_turnos')
        .select(
          'id,responsable,quintal,amasado,masa_ocupa,masa_queda,pan_racion,pan_meson,pan_sobra,cacho,centeno,meson,kilos,rinde'
        )
        .eq('planilla_id', planilla.id)
        .eq('turno', turnoConfig.orden)
        .maybeSingle();
      turnoDb = respuesta.data ? { ...respuesta.data, panaderos: 0 } : null;
      errorTurno = respuesta.error;
    }

    if (errorTurno) {
      if (!cargaVigente()) return;
      limpiarTurno();
      setTurnoCargadoClave('');
      return;
    }

    const { data: turnoAnterior } =
      turnoConfig.orden > 1
        ? await supabase
            .from('planilla_turnos')
            .select('pan_sobra')
            .eq('planilla_id', planilla.id)
            .eq('turno', turnoConfig.orden - 1)
            .maybeSingle()
        : { data: null };

    const [{ data: detallesData }, { data: insumosData }] = await Promise.all([
      supabase
        .from('planilla_detalles')
        .select('producto_id,nombre_producto,kilos_total,merma')
        .eq('planilla_id', planilla.id)
        .like('nombre_producto', `% [turno:${turnoConfig.orden}]`),
      turnoDb
        ? supabase
            .from('planilla_insumos')
            .select('id,nombre,cantidad,unidad')
            .eq('planilla_turno_id', turnoDb.id)
        : Promise.resolve({ data: [] }),
    ]);

    const detalles = (detallesData || []) as {
      producto_id: number | null;
      nombre_producto: string;
      kilos_total: number;
      merma: number;
    }[];
    const insumosGuardados = (insumosData || []) as {
      id: string;
      nombre: string;
      cantidad: number;
      unidad: string;
    }[];
    const marcadorTurno = ` [turno:${turnoConfig.orden}]`;
    const sufijoTurno = ` - ${turnoConfig.nombre}`;
    const detalleRepartos = detalles.filter(
      (item) =>
        !item.producto_id &&
        !normalizar(item.nombre_producto).startsWith('merma')
    );
    const detalleProductos = detalles.filter(
      (item) =>
        item.producto_id &&
        !normalizar(item.nombre_producto).startsWith('merma')
    );
    const detalleOtros = detalles.filter((item) =>
      normalizar(item.nombre_producto).startsWith('merma')
    );
    const turnosResumen = String(planilla.turno || '')
      .split(',')
      .map((item) => normalizar(item));
    const turnoEnResumen = turnosResumen.some(
      (item) =>
        item === normalizar(turnoConfig.nombre) ||
        item === normalizar(`Turno ${turnoConfig.orden}`)
    );
    const resumenUnSoloTurno = turnosResumen.length <= 1 && turnoEnResumen;

    if (!turnoDb && !turnoEnResumen && detalleRepartos.length === 0) {
      if (!cargaVigente()) return;
      limpiarTurno();
      setTurnoCargadoClave('');
      return;
    }

    const mermaGuardada = detalles.reduce(
      (total, item) => total + Number(item.merma || 0),
      0
    );
    const repartosPorNombre = new Map<string, number>();
    for (const item of detalleRepartos) {
        let nombre = item.nombre_producto.replace(marcadorTurno, '').trim();
        if (nombre.endsWith(sufijoTurno)) {
          nombre = nombre.slice(0, -sufijoTurno.length).trim();
        }
      const kilos = Number(item.kilos_total || 0);
      repartosPorNombre.set(normalizar(nombre), kilos);
      repartosPorNombre.set(normalizar(referenciaRepartidor(nombre)), kilos);
    }
    const mesonHistorico = Number(
      turnoDb?.pan_meson ?? (resumenUnSoloTurno ? planilla.pan_meson : 0) ?? 0
    );
    const claveMeson = normalizar(repartoMesonNombre);

    if (mesonHistorico > 0 && !repartosPorNombre.has(claveMeson)) {
      repartosPorNombre.set(claveMeson, mesonHistorico);
    }

    const baseRepartos = repartosBase().map((item) => ({
      ...item,
      kilos: repartosPorNombre.get(normalizar(item.nombre)) || 0,
    }));
    const repartosExtras = detalleRepartos
      .map((item) => {
        let nombre = item.nombre_producto.replace(marcadorTurno, '').trim();
        if (nombre.endsWith(sufijoTurno)) {
          nombre = nombre.slice(0, -sufijoTurno.length).trim();
        }
        return {
          id: `guardado-${nombre}`,
          nombre: referenciaRepartidor(nombre),
          kilos: Number(item.kilos_total || 0),
        };
      })
      .filter(
        (item) =>
          item.kilos > 0 &&
          !baseRepartos.some(
            (base) => normalizar(base.nombre) === normalizar(item.nombre)
          )
      );

    const productosPorId = new Map(
      detalleProductos.map((item) => [
        Number(item.producto_id),
        Number(item.kilos_total || 0),
      ])
    );
    const baseProductosTurno = productosTurnoBase()
      .map((item) => ({
        ...item,
        kilos: productosPorId.get(item.producto_id) || 0,
      }))
      .filter((item) => item.kilos > 0);
    const productosExtras = detalleProductos
      .map((item) => {
        let nombre = item.nombre_producto.replace(marcadorTurno, '').trim();
        if (nombre.endsWith(sufijoTurno)) {
          nombre = nombre.slice(0, -sufijoTurno.length).trim();
        }

        return {
          id: `guardado-producto-${item.producto_id}`,
          producto_id: Number(item.producto_id || 0),
          nombre,
          kilos: Number(item.kilos_total || 0),
        };
      })
      .filter(
        (item) =>
          item.kilos > 0 &&
          !baseProductosTurno.some(
            (base) => base.producto_id === item.producto_id
          )
      );
    const otrosGuardados = detalleOtros
      .filter((item) => Number(item.merma || 0) > 0)
      .map((item, indice) => {
        let nombre = item.nombre_producto
          .replace(/^Merma\/Otro:\s*/i, '')
          .replace(/^Merma\s*-\s*/i, '')
          .replace(marcadorTurno, '')
          .trim();
        if (nombre.endsWith(sufijoTurno)) {
          nombre = nombre.slice(0, -sufijoTurno.length).trim();
        }
        const [clienteNombre, productoNombre] = nombre
          .split(' / ')
          .map((parte) => parte.trim());

        return {
          id: `guardado-otro-${indice}`,
          cliente_id: null,
          cliente_nombre: clienteNombre || 'Otro',
          producto_id: item.producto_id ? Number(item.producto_id) : null,
          producto_nombre: productoNombre || 'Producto pan',
          kilos: Number(item.merma || 0),
        };
      });

    const insumosPorNombre = new Map(
      insumosGuardados.map((item) => [normalizar(item.nombre), item])
    );
    const baseInsumos = insumosBase().map((item) => {
      const guardado = insumosPorNombre.get(normalizar(item.nombre));
      return guardado
        ? {
            ...item,
            cantidad: Number(guardado.cantidad || 0),
            unidad: guardado.unidad || item.unidad,
          }
        : item;
    });
    const insumosExtras = insumosGuardados
      .filter(
        (item) =>
          !baseInsumos.some(
            (base) => normalizar(base.nombre) === normalizar(item.nombre)
          )
      )
      .map((item) => ({
        id: item.id,
        producto_id: 0,
        nombre: item.nombre,
        unidad: item.unidad || 'kg',
        cantidad: Number(item.cantidad || 0),
      }));

    const quintalResumen =
      turnoConfig.orden === 1 ? planilla.quintal1 : planilla.quintal2;
    const amasadoResumen =
      turnoConfig.orden === 1 ? planilla.amasado1 : planilla.amasado2;
    const usarResumenHistorico = !turnoDb && turnoEnResumen;
    const usarTotalesHistoricosEnPrimerTurno =
      usarResumenHistorico && turnoConfig.orden === 1;

    if (!cargaVigente()) return;

    setResponsable(turnoDb?.responsable || planilla.responsable || '');
    setQuintal(Number(turnoDb?.quintal ?? quintalResumen ?? 0));
    setPanaderos(Number(turnoDb?.panaderos || 0));
    setObservaciones('');
    setPanSobranteAnterior(
      Number(
        turnoAnterior?.pan_sobra ??
          (usarResumenHistorico && turnoConfig.orden === 2
            ? planilla.pan_sobra
            : 0) ??
          0
      )
    );
    setTurno({
      amasado: Number(turnoDb?.amasado ?? amasadoResumen ?? 0),
      masaOcupa: Number(
        turnoDb?.masa_ocupa ??
          (resumenUnSoloTurno || usarTotalesHistoricosEnPrimerTurno
            ? planilla.masa_ocupada
            : 0) ??
          0
      ),
      masaQueda: Number(
        turnoDb?.masa_queda ??
          (resumenUnSoloTurno || usarTotalesHistoricosEnPrimerTurno
            ? planilla.masa_sobrante
            : 0) ??
          0
      ),
      panRacion: Number(
        turnoDb?.pan_racion ??
          (resumenUnSoloTurno || usarTotalesHistoricosEnPrimerTurno
            ? planilla.pan_racion
            : 0) ??
          0
      ),
      panSobrante: Number(
        turnoDb?.pan_sobra ??
          (resumenUnSoloTurno || usarTotalesHistoricosEnPrimerTurno
            ? planilla.pan_sobra
            : 0) ??
          0
      ),
      merma: mermaGuardada,
      cacho: Number(
        turnoDb?.cacho ??
          (resumenUnSoloTurno || usarTotalesHistoricosEnPrimerTurno
            ? planilla.cacho
            : 0) ??
          0
      ),
      centeno: Number(
        turnoDb?.centeno ??
          (resumenUnSoloTurno || usarTotalesHistoricosEnPrimerTurno
            ? planilla.centeno
            : 0) ??
          0
      ),
      meson: Number(
        turnoDb?.meson ??
          (resumenUnSoloTurno || usarTotalesHistoricosEnPrimerTurno
            ? planilla.meson
            : 0) ??
          0
      ),
      otroskg: 0,
    });
    setRepartos([...baseRepartos, ...repartosExtras]);
    setProductosTurno([...baseProductosTurno, ...productosExtras]);
    setOtrosTurno(otrosGuardados);
    setInsumos([...baseInsumos, ...insumosExtras]);
    setTurnoCargadoClave(claveBorrador(fechaSeleccionada, turnoConfig.orden));
    setMensaje(
      turnoDb
        ? `${turnoConfig.nombre} cargado desde la planilla del dia.`
        : `${turnoConfig.nombre} cargado desde resumen historico del dia.`
    );
  }

  function cambiarTurnoSeleccionado(turnoId: string) {
    if (turnoId === turnoSeleccionadoId) return;
    guardarBorradorTurnoActual();
    setTurnoCargadoClave('');
    setTurnoSeleccionadoId(turnoId);
  }

  async function eliminarTurnoIncompleto(
    turnoId: string,
    planillaId: string,
    planillaNueva: boolean
  ) {
    await supabase
      .from('planilla_insumos')
      .delete()
      .eq('planilla_turno_id', turnoId);
    await supabase.from('planilla_turnos').delete().eq('id', turnoId);
    await supabase
      .from('planilla_detalles')
      .delete()
      .eq('planilla_id', planillaId)
      .like('nombre_producto', `% [turno:${turnoSeleccionado?.orden}]`);

    if (planillaNueva) {
      await supabase.from('planillas').delete().eq('id', planillaId);
    }
  }

  async function actualizarResumenPlanilla(
    planillaId: string,
    observacionActual: string
  ) {
    let { data, error } = await supabase
      .from('planilla_turnos')
      .select(`
        turno,
        quintal,
        amasado,
        panaderos,
        masa_ocupa,
        masa_queda,
        pan_racion,
        pan_meson,
        pan_sobra,
        cacho,
        otroskg,
        centeno,
        meson,
        kilos,
        rinde
      `)
      .eq('planilla_id', planillaId)
      .order('turno', { ascending: true });

    if (esErrorColumnaPanaderos(error)) {
      setPanaderosDisponible(false);
      const respuesta = await supabase
        .from('planilla_turnos')
        .select(`
          turno,
          quintal,
          amasado,
          masa_ocupa,
          masa_queda,
          pan_racion,
          pan_meson,
          pan_sobra,
          cacho,
          otroskg,
          centeno,
          meson,
          kilos,
          rinde
        `)
        .eq('planilla_id', planillaId)
        .order('turno', { ascending: true });
      data = (respuesta.data || []).map((item) => ({
        ...item,
        panaderos: 0,
      }));
      error = respuesta.error;
    }

    if (error) throw error;

    const turnos = ((data || []) as TurnoGuardado[]).map((item, indice, lista) => {
      const anterior = lista.find(
        (turnoItem) => Number(turnoItem.turno || 0) === Number(item.turno || 0) - 1
      );
      const kilos = kilosConProductosIncluidos(item, Number(anterior?.pan_sobra || 0));
      const factor = calcularFactorAmasado(
        Number(item.amasado || 0),
        Number(item.masa_ocupa || 0),
        Number(item.masa_queda || 0)
      );

      return {
        ...item,
        kilos,
        rinde: factor > 0 ? Number((kilos / factor).toFixed(2)) : item.rinde,
      };
    });
    const primera = turnos.find((item) => item.turno === 1);
    const segunda = turnos.find((item) => item.turno === 2);
    const kilosTotal = turnos.reduce(
      (total, item) => total + Number(item.kilos || 0),
      0
    );
    const factorTotal = turnos.reduce((total, item) => {
      const rinde = Number(item.rinde || 0);
      return total + (rinde > 0 ? Number(item.kilos || 0) / rinde : 0);
    }, 0);
    const rindeTotal = factorTotal > 0 ? kilosTotal / factorTotal : 0;

    const { error: errorResumen } = await supabase
      .from('planillas')
      .update({
        turno: turnos
          .map(
            (item) =>
              turnosConfigurados.find((config) => config.orden === item.turno)
                ?.nombre || `Turno ${item.turno}`
          )
          .join(', '),
        responsable: turnos.length === 1 ? responsable.trim() : 'Varios',
        quintal1: Number(primera?.quintal || 0),
        quintal2: Number(segunda?.quintal || 0),
        centeno: turnos.reduce(
          (total, item) => total + Number(item.centeno || 0),
          0
        ),
        meson: turnos.reduce(
          (total, item) => total + Number(item.meson || 0),
          0
        ),
        quintal_total: turnos.reduce(
          (total, item) =>
            total +
            Number(item.quintal || 0) +
            Number(item.centeno || 0) +
            Number(item.meson || 0),
          0
        ),
        masa_ocupada: turnos.reduce(
          (total, item) => total + Number(item.masa_ocupa || 0),
          0
        ),
        masa_sobrante: turnos.reduce(
          (total, item) => total + Number(item.masa_queda || 0),
          0
        ),
        kilos_producidos: kilosTotal,
        rinde: Number(rindeTotal.toFixed(2)),
        observaciones: observacionActual || null,
        amasado1: Number(primera?.amasado || 0),
        amasado2: Number(segunda?.amasado || 0),
        amasado_total: turnos.reduce(
          (total, item) => total + Number(item.amasado || 0),
          0
        ),
        pan_racion: turnos.reduce(
          (total, item) => total + Number(item.pan_racion || 0),
          0
        ),
        pan_meson: 0,
        pan_sobra: turnos.reduce(
          (total, item) => total + Number(item.pan_sobra || 0),
          0
        ),
        cacho: turnos.reduce(
          (total, item) => total + Number(item.cacho || 0),
          0
        ),
        rinde_por_saco: Number(rindeTotal.toFixed(2)),
      })
      .eq('id', planillaId);

    if (errorResumen) throw errorResumen;
  }

  async function guardarTurno() {
    setMensaje('');

    if (!turnoSeleccionado) {
      alert('Selecciona un turno configurado.');
      return;
    }

    if (!responsable.trim()) {
      alert('Ingresa el responsable del turno.');
      return;
    }

    if (calculo.factorAmasado <= 0) {
      alert('Ingresa el amasado del turno antes de guardar.');
      return;
    }

    if (
      repartos.some(
        (item) => item.kilos > 0 && !item.nombre.trim()
      )
    ) {
      alert('Asigna un nombre a cada reparto que tenga kilos.');
      return;
    }

    if (
      insumos.some(
        (item) =>
          item.cantidad > 0 &&
          (!item.nombre.trim() || !item.unidad.trim())
      )
    ) {
      alert('Completa el nombre y la unidad de cada insumo utilizado.');
      return;
    }

    setGuardando(true);

    try {
      const empresa = await obtenerEmpresaActual();
      if (!empresa) throw new Error('No se pudo identificar la empresa.');

      const { data: planillaExistente, error: errorConsulta } = await supabase
        .from('planillas')
        .select('id, observaciones')
        .eq('empresa_id', empresa.id)
        .eq('fecha', fecha)
        .limit(1)
        .maybeSingle();

      if (errorConsulta) throw errorConsulta;

      let planillaId = planillaExistente?.id as string | undefined;
      let planillaNueva = false;

      if (!planillaId) {
        const { data: nuevaPlanilla, error: errorPlanilla } = await supabase
          .from('planillas')
          .insert({
            empresa_id: empresa.id,
            fecha,
            turno: turnoSeleccionado.nombre,
            responsable: responsable.trim(),
            observaciones: observaciones.trim() || null,
          })
          .select('id')
          .single();

        if (errorPlanilla || !nuevaPlanilla) {
          throw errorPlanilla || new Error('No se pudo crear la planilla.');
        }

        planillaId = nuevaPlanilla.id;
        planillaNueva = true;
      }

      const { data: turnoExistente, error: errorTurnoExistente } = await supabase
        .from('planilla_turnos')
        .select('id')
        .eq('planilla_id', planillaId)
        .eq('turno', turnoSeleccionado.orden)
        .limit(1)
        .maybeSingle();

      if (errorTurnoExistente) throw errorTurnoExistente;

      const turnoId = turnoExistente?.id || crypto.randomUUID();
      const totalInsumos = insumos.reduce(
        (total, item) => total + item.cantidad,
        0
      );
      const payloadTurno = {
        planilla_id: planillaId,
        turno: turnoSeleccionado.orden,
        responsable: responsable.trim(),
        quintal,
        amasado: turno.amasado,
        masa_ocupa: turno.masaOcupa,
        masa_queda: turno.masaQueda,
        pan_racion: turno.panRacion,
        pan_meson: 0,
        pan_sobra: turno.panSobrante || 0,
        cacho: turno.cacho || 0,
        otroskg: kilosProductosTurno,
        centeno: turno.centeno || 0,
        meson: turno.meson || 0,
        reparto: kilosRepartos,
        insumos: totalInsumos,
        kilos: calculo.kilos,
        rinde: calculo.rinde,
        ...(panaderosDisponible ? { panaderos } : {}),
      };

      let { error: errorTurno } = turnoExistente
        ? await supabase
            .from('planilla_turnos')
            .update(payloadTurno)
            .eq('id', turnoId)
        : await supabase
            .from('planilla_turnos')
            .insert({
              id: turnoId,
              ...payloadTurno,
            });

      if (esErrorColumnaPanaderos(errorTurno)) {
        setPanaderosDisponible(false);
        const { panaderos: _panaderos, ...payloadSinPanaderos } =
          payloadTurno as typeof payloadTurno & { panaderos?: number };
        const respuesta = turnoExistente
          ? await supabase
              .from('planilla_turnos')
              .update(payloadSinPanaderos)
              .eq('id', turnoId)
          : await supabase
              .from('planilla_turnos')
              .insert({
                id: turnoId,
                ...payloadSinPanaderos,
              });
        errorTurno = respuesta.error;
      }

      if (errorTurno) {
        if (planillaNueva) {
          await supabase.from('planillas').delete().eq('id', planillaId);
        }
        throw errorTurno;
      }

      const { error: errorBorrarInsumos } = await supabase
        .from('planilla_insumos')
        .delete()
        .eq('planilla_turno_id', turnoId);
      if (errorBorrarInsumos) throw errorBorrarInsumos;

      const { error: errorBorrarRepartos } = await supabase
        .from('planilla_detalles')
        .delete()
        .eq('planilla_id', planillaId)
        .like('nombre_producto', `% [turno:${turnoSeleccionado.orden}]`);
      if (errorBorrarRepartos) throw errorBorrarRepartos;

      const filasInsumos = insumos
        .filter((item) => item.cantidad > 0)
        .map((item) => ({
          planilla_turno_id: turnoId,
          nombre: item.nombre.trim(),
          cantidad: item.cantidad,
          unidad: item.unidad.trim(),
        }));

      if (filasInsumos.length > 0) {
        const { error: errorInsumos } = await supabase
          .from('planilla_insumos')
          .insert(filasInsumos);

        if (errorInsumos) {
          if (planillaNueva) {
            await eliminarTurnoIncompleto(turnoId, planillaId, planillaNueva);
          }
          throw errorInsumos;
        }
      }

      const filasRepartos = repartos
        .filter((item) => item.kilos > 0)
        .map((item) => ({
          planilla_id: planillaId,
          producto_id: null,
          nombre_producto: `${item.nombre.trim()} - ${turnoSeleccionado.nombre} [turno:${turnoSeleccionado.orden}]`,
          cantidad: 1,
          peso_unitario: item.kilos,
          kilos_total: item.kilos,
          merma: 0,
        }));

      productosTurno
        .filter((item) => item.kilos > 0)
        .forEach((item) => {
          filasRepartos.push({
            planilla_id: planillaId,
            producto_id: item.producto_id,
            nombre_producto: `${item.nombre.trim()} - ${turnoSeleccionado.nombre} [turno:${turnoSeleccionado.orden}]`,
            cantidad: 1,
            peso_unitario: item.kilos,
            kilos_total: item.kilos,
            merma: 0,
          });
        });

      otrosTurno
        .filter((item) => item.kilos > 0)
        .forEach((item) => {
          filasRepartos.push({
            planilla_id: planillaId,
            producto_id: item.producto_id,
            nombre_producto: `Merma/Otro: ${item.cliente_nombre.trim()} / ${item.producto_nombre.trim()} - ${turnoSeleccionado.nombre} [turno:${turnoSeleccionado.orden}]`,
            cantidad: 0,
            peso_unitario: 0,
            kilos_total: 0,
            merma: Number(item.kilos || 0),
          });
        });

      if (Number(turno.merma || 0) > 0 && otrosTurno.length === 0) {
        filasRepartos.push({
          planilla_id: planillaId,
          producto_id: null,
          nombre_producto: `Merma - ${turnoSeleccionado.nombre} [turno:${turnoSeleccionado.orden}]`,
          cantidad: 0,
          peso_unitario: 0,
          kilos_total: 0,
          merma: Number(turno.merma || 0),
        });
      }

      if (filasRepartos.length > 0) {
        const { error: errorRepartos } = await supabase
          .from('planilla_detalles')
          .insert(filasRepartos);

        if (errorRepartos) {
          if (planillaNueva) {
            await eliminarTurnoIncompleto(turnoId, planillaId, planillaNueva);
          }
          throw errorRepartos;
        }
      }

      const observacionConsolidada = [
        planillaExistente?.observaciones,
        observaciones.trim()
          ? `${turnoSeleccionado.nombre}: ${observaciones.trim()}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      try {
        await actualizarResumenPlanilla(planillaId, observacionConsolidada);
      } catch (error) {
        if (planillaNueva) {
          await eliminarTurnoIncompleto(turnoId, planillaId, planillaNueva);
        }
        throw error;
      }

      setMensaje(
        `${turnoSeleccionado.nombre} guardado correctamente.`
      );
      setColumnaEditable('');
      setCeldaEditable(null);
      delete borradoresTurno.current[
        claveBorrador(fecha, turnoSeleccionado.orden)
      ];
      borradoresEditados.current.delete(
        claveBorrador(fecha, turnoSeleccionado.orden)
      );
      await cargarResumenDia(fecha);
      await cargarResumenMensual(fecha);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo guardar el turno.');
    } finally {
      setGuardando(false);
    }
  }

  const colorEstado = colorRinde(calculo.estadoRinde);
  const estadoRindeGeneral: ReturnType<typeof clasificarRinde> = resumenDia
    ? clasificarRinde(resumenDia.rinde_por_saco)
    : 'bajo';
  const colorRindeGeneral = resumenDia
    ? colorRinde(estadoRindeGeneral)
    : 'border-[#A51F2B]/20 bg-[#A51F2B] text-white';
  const { anio: anioMes, mes: mesSeleccionado, ultimoDia } = rangoMes(fecha);
  const diasMes = Array.from({ length: ultimoDia }, (_, indice) => indice + 1);
  const fechaDiaMes = (dia: number) =>
    `${anioMes}-${String(mesSeleccionado).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  const etiquetaDiaMes = (dia: number) => String(dia).padStart(2, '0');
  const valorMes = (
    dia: number,
    fila: FilaMensual,
    decimales = 2
  ) => {
    const valor = valorCeldaMensual(fechaDiaMes(dia), fila);
    return valor ? numeroDia(valor, decimales) : '';
  };

  type FilaMensual = {
    label: string;
    obtener: (item: ResumenMensualDia) => number;
    vivo?: (item: ResumenMensualDia) => number;
    decimales: number;
    editable?: {
      turno?: number;
      campo: CampoGrilla;
      insumoId?: string;
      repartoId?: string;
      productoTurnoId?: string;
    };
  };

  function resumenMensualVacio(fechaCelda: string): ResumenMensualDia {
    return {
      fecha: fechaCelda,
      planilla: {
        quintal1: 0,
        quintal2: 0,
        centeno: 0,
        meson: 0,
        quintal_total: 0,
        amasado1: 0,
        amasado2: 0,
        amasado_total: 0,
        masa_ocupada: 0,
        masa_sobrante: 0,
        kilos_producidos: 0,
        rinde_por_saco: 0,
        pan_racion: 0,
        pan_sobra: 0,
        cacho: 0,
      },
      turnos: {},
      insumos: {},
      merma: 0,
    };
  }

  function datosMensualesBorrador(borrador: BorradorTurno) {
    const datos = {
      ...borrador.turno,
      otroskg: borrador.productosTurno.reduce(
        (total, producto) => total + Number(producto.kilos || 0),
        0
      ),
      panSobranteAnterior: borrador.panSobranteAnterior,
      repartos: borrador.repartos.map((reparto) => Number(reparto.kilos || 0)),
    };
    const calculoBorrador = calcularTurno(datos);

    return {
      quintal: borrador.quintal,
      amasado: borrador.turno.amasado,
      panaderos: borrador.panaderos,
      masa_ocupa: borrador.turno.masaOcupa,
      masa_queda: borrador.turno.masaQueda,
      pan_racion: borrador.turno.panRacion,
      pan_sobra: borrador.turno.panSobrante || 0,
      cacho: borrador.turno.cacho || 0,
      centeno: borrador.turno.centeno || 0,
      meson: borrador.turno.meson || 0,
      kilos: calculoBorrador.kilos,
      rinde: calculoBorrador.rinde,
      reparto: borrador.repartos.reduce(
        (total, reparto) => total + Number(reparto.kilos || 0),
        0
      ),
      repartos: Object.fromEntries(
        borrador.repartos.map((reparto) => [
          normalizar(reparto.nombre),
          Number(reparto.kilos || 0),
        ])
      ),
      otroskg: datos.otroskg,
      merma: borrador.turno.merma || 0,
      insumos: Object.fromEntries(
        borrador.insumos.map((insumo) => [
          normalizar(insumo.nombre),
          Number(insumo.cantidad || 0),
        ])
      ),
      factor: calculoBorrador.factorAmasado,
    };
  }

  function turnoMensualVivo(item: ResumenMensualDia, orden: number) {
    const guardado = item.turnos[orden];
    const clave = claveBorrador(item.fecha, orden);
    const borrador = borradoresTurno.current[clave];
    const borradorEditado = borradoresEditados.current.has(clave);
    const esTurnoActual =
      item.fecha === fecha && orden === turnoSeleccionado?.orden;
    const turnoActualCargado =
      esTurnoActual && turnoCargadoClave === claveBorrador(fecha, orden);

    if (borrador && borradorEditado && !turnoActualCargado) {
      return datosMensualesBorrador(borrador);
    }

    if (!turnoActualCargado) {
      const kilosGuardados = kilosConProductosIncluidos(
        guardado || {},
        item.turnos[orden - 1]?.pan_sobra || 0
      );
      const factorGuardado = calcularFactorAmasado(
        Number(guardado?.amasado || 0),
        Number(guardado?.masa_ocupa || 0),
        Number(guardado?.masa_queda || 0)
      );

      return {
        quintal: Number(guardado?.quintal || 0),
        amasado: Number(guardado?.amasado || 0),
        panaderos: Number(guardado?.panaderos || 0),
        masa_ocupa: Number(guardado?.masa_ocupa || 0),
        masa_queda: Number(guardado?.masa_queda || 0),
        pan_racion: Number(guardado?.pan_racion || 0),
        pan_sobra: Number(guardado?.pan_sobra || 0),
        cacho: Number(guardado?.cacho || 0),
        centeno: Number(guardado?.centeno || 0),
        meson: Number(guardado?.meson || 0),
        kilos: kilosGuardados,
        rinde:
          factorGuardado > 0
            ? Number((kilosGuardados / factorGuardado).toFixed(2))
            : Number(guardado?.rinde || 0),
        reparto: Number(guardado?.reparto || 0),
        repartos: guardado?.repartos || {},
        otroskg: Number(guardado?.otroskg || 0),
        merma: Number(guardado?.merma || 0),
        insumos: guardado?.insumos || {},
        factor: factorGuardado,
      };
    }

    return {
      quintal,
      amasado: turno.amasado,
      panaderos,
      masa_ocupa: turno.masaOcupa,
      masa_queda: turno.masaQueda,
      pan_racion: turno.panRacion,
      pan_sobra: turno.panSobrante || 0,
      cacho: turno.cacho || 0,
      centeno: turno.centeno || 0,
      meson: turno.meson || 0,
      kilos: calculo.kilos,
      rinde: calculo.rinde,
      reparto: kilosRepartos,
      repartos: Object.fromEntries(
        repartos.map((item) => [normalizar(item.nombre), Number(item.kilos || 0)])
      ),
      otroskg: kilosProductosTurno,
      merma: turno.merma || 0,
      insumos: Object.fromEntries(
        insumos.map((item) => [normalizar(item.nombre), Number(item.cantidad || 0)])
      ),
      factor: calculo.factorAmasado,
    };
  }

  function ordenesMensualesVivas(item: ResumenMensualDia) {
    const ordenes = new Set(
      Object.keys(item.turnos)
        .map(Number)
        .filter((orden) => orden > 0)
    );

    Object.keys(borradoresTurno.current).forEach((clave) => {
      const [fechaBorrador, ordenBorrador] = clave.split('::');
      if (fechaBorrador === item.fecha) {
        ordenes.add(Number(ordenBorrador));
      }
    });

    if (item.fecha === fecha && turnoSeleccionado?.orden) {
      ordenes.add(turnoSeleccionado.orden);
    }

    return Array.from(ordenes);
  }

  type TurnoMensualVivo = ReturnType<typeof turnoMensualVivo>;

  function totalMensualVivo(item: ResumenMensualDia, campo: keyof TurnoMensualVivo) {
    return ordenesMensualesVivas(item).reduce(
      (total, orden) => total + Number(turnoMensualVivo(item, orden)[campo] || 0),
      0
    );
  }

  function valorCeldaMensual(fechaCelda: string, fila: FilaMensual) {
    const item = resumenMensual[fechaCelda] || resumenMensualVacio(fechaCelda);
    const turnoActualCargado = Boolean(
      turnoSeleccionado &&
        turnoCargadoClave === claveBorrador(fecha, turnoSeleccionado.orden)
    );
    const tieneBorradorFila = fila.editable?.turno
      ? Boolean(
          borradoresEditados.current.has(
            claveBorrador(fechaCelda, fila.editable.turno)
          )
        )
      : Object.keys(borradoresTurno.current).some((clave) =>
          clave.startsWith(`${fechaCelda}::`) &&
          borradoresEditados.current.has(clave)
        );
    return fila.vivo &&
      (tieneBorradorFila || (fechaCelda === fecha && turnoActualCargado))
      ? fila.vivo(item)
      : fila.obtener(item);
  }

  const repartosGrilla = repartos.filter(
    (item) => normalizar(item.nombre) !== normalizar(repartoMesonNombre)
  );

  function seccionFilaMensual(label: string) {
    const etiqueta = normalizar(label);
    if (
      [
        'quintales vaciados',
        'kilos',
        'rinde',
        'total amasado',
        'masa 1ra',
        'masa 2da',
        'kilos 1ra',
        'kilos 2da',
        'total kilos',
        'rinde 1ra',
        'rinde 2da',
        'total panaderos',
      ].includes(etiqueta)
    ) {
      return 'Calculos';
    }

    if (
      ['1ra', '2da', 'centeno', 'meson sala venta'].includes(etiqueta) ||
      etiqueta === '+ insumos' ||
      insumos.some((item) => {
        const nombre = normalizar(item.nombre);
        return (
          etiqueta === nombre ||
          etiqueta === `${nombre} 1ra` ||
          etiqueta === `${nombre} 2da`
        );
      }) ||
      etiqueta === 'quintales vaciados'
    ) {
      return 'Insumos';
    }

    if (
      etiqueta.includes('amasado') ||
      etiqueta.includes('masa queda') ||
      etiqueta.includes('masa ocupada') ||
      etiqueta === 'masa 1ra' ||
      etiqueta === 'masa 2da'
    ) {
      return 'Amasado';
    }

    if (
      etiqueta.includes('raciones') ||
      etiqueta.includes('cacho') ||
      etiqueta.includes('merma') ||
      etiqueta.includes('otros') ||
      etiqueta.includes('kpan') ||
      etiqueta.includes('productos rinde') ||
      etiqueta.startsWith('prod.')
    ) {
      return 'Kilos';
    }

    if (etiqueta.includes('repartos') || etiqueta.startsWith('rep.')) {
      return 'Repartos';
    }

    if (
      repartosGrilla.some(
        (reparto) => etiqueta === normalizar(`Total ${reparto.nombre}`)
      )
    ) {
      return 'Repartos';
    }

    if (etiqueta.includes('panaderos')) {
      return 'Personal';
    }

    return 'Resultado';
  }

  function valorTurnoMensual(
    item: ResumenMensualDia,
    orden: number,
    campo: keyof ResumenMensualDia['turnos'][number],
    fallback = 0
  ) {
    const turnoGuardado = item.turnos[orden];
    return turnoGuardado ? Number(turnoGuardado[campo] ?? 0) : fallback;
  }

  const filasMensuales: FilaMensual[] = [
    { label: 'Quintales vaciados', obtener: (item) => item.planilla.quintal_total, vivo: (item) => totalMensualVivo(item, 'quintal') + totalMensualVivo(item, 'centeno') + totalMensualVivo(item, 'meson'), decimales: 2 },
    { label: 'KILOS', obtener: (item) => item.planilla.kilos_producidos, vivo: (item) => totalMensualVivo(item, 'kilos'), decimales: 2 },
    { label: 'RINDE', obtener: (item) => item.planilla.rinde_por_saco, vivo: (item) => totalMensualVivo(item, 'factor') > 0 ? totalMensualVivo(item, 'kilos') / totalMensualVivo(item, 'factor') : 0, decimales: 2 },
    {
      label: 'Total amasado',
      obtener: (item) => {
        const turnos = Object.values(item.turnos);
        if (turnos.length > 0) {
          return turnos.reduce(
            (total, turnoItem) =>
              total +
              calcularFactorAmasado(
                turnoItem.amasado,
                turnoItem.masa_ocupa,
                turnoItem.masa_queda
              ),
            0
          );
        }

        return calcularFactorAmasado(
          item.planilla.amasado_total,
          item.planilla.masa_ocupada,
          item.planilla.masa_sobrante
        );
      },
      vivo: (item) => totalMensualVivo(item, 'factor'),
      decimales: 2,
    },
    { label: 'Masa 1ra', obtener: (item) => valorTurnoMensual(item, 1, 'masa_ocupa') - valorTurnoMensual(item, 1, 'masa_queda'), vivo: (item) => turnoMensualVivo(item, 1).masa_ocupa - turnoMensualVivo(item, 1).masa_queda, decimales: 2 },
    { label: 'Masa 2da', obtener: (item) => valorTurnoMensual(item, 2, 'masa_ocupa', item.planilla.masa_ocupada) - valorTurnoMensual(item, 2, 'masa_queda', item.planilla.masa_sobrante), vivo: (item) => turnoMensualVivo(item, 2).masa_ocupa - turnoMensualVivo(item, 2).masa_queda, decimales: 2 },
    { label: 'Kilos 1ra', obtener: (item) => valorTurnoMensual(item, 1, 'kilos'), vivo: (item) => turnoMensualVivo(item, 1).kilos, decimales: 2 },
    { label: 'Kilos 2da', obtener: (item) => valorTurnoMensual(item, 2, 'kilos'), vivo: (item) => turnoMensualVivo(item, 2).kilos, decimales: 2 },
    { label: 'Total kilos', obtener: (item) => item.planilla.kilos_producidos, vivo: (item) => totalMensualVivo(item, 'kilos'), decimales: 2 },
    { label: 'Rinde 1ra', obtener: (item) => valorTurnoMensual(item, 1, 'rinde'), vivo: (item) => turnoMensualVivo(item, 1).rinde, decimales: 2 },
    { label: 'Rinde 2da', obtener: (item) => valorTurnoMensual(item, 2, 'rinde'), vivo: (item) => turnoMensualVivo(item, 2).rinde, decimales: 2 },
    { label: 'Total panaderos', obtener: (item) => valorTurnoMensual(item, 1, 'panaderos') + valorTurnoMensual(item, 2, 'panaderos'), vivo: (item) => totalMensualVivo(item, 'panaderos'), decimales: 0 },
    { label: '1ra', obtener: (item) => valorTurnoMensual(item, 1, 'quintal', item.planilla.quintal1), vivo: (item) => turnoMensualVivo(item, 1).quintal, decimales: 2, editable: { turno: 1, campo: 'quintal' } },
    { label: '2da', obtener: (item) => valorTurnoMensual(item, 2, 'quintal', item.planilla.quintal2), vivo: (item) => turnoMensualVivo(item, 2).quintal, decimales: 2, editable: { turno: 2, campo: 'quintal' } },
    { label: 'Centeno', obtener: (item) => item.planilla.centeno, vivo: (item) => totalMensualVivo(item, 'centeno'), decimales: 2, editable: { campo: 'centeno' } },
    { label: '+ Insumos', obtener: () => 0, decimales: 0, editable: { campo: 'agregarInsumo' } },
    { label: 'Meson sala venta', obtener: (item) => item.planilla.meson, vivo: (item) => totalMensualVivo(item, 'meson'), decimales: 2, editable: { campo: 'meson' } },
    ...insumos.flatMap((insumo) => [
      {
        label: `${insumo.nombre} 1ra`,
        obtener: (item: ResumenMensualDia) =>
          item.turnos[1]?.insumos?.[normalizar(insumo.nombre)] || 0,
        vivo: (item: ResumenMensualDia) =>
          turnoMensualVivo(item, 1).insumos[normalizar(insumo.nombre)] || 0,
        decimales: 2,
        editable: {
          turno: 1,
          campo: 'insumo' as CampoGrilla,
          insumoId: insumo.id,
        },
      },
      {
        label: `${insumo.nombre} 2da`,
        obtener: (item: ResumenMensualDia) =>
          item.turnos[2]?.insumos?.[normalizar(insumo.nombre)] || 0,
        vivo: (item: ResumenMensualDia) =>
          turnoMensualVivo(item, 2).insumos[normalizar(insumo.nombre)] || 0,
        decimales: 2,
        editable: {
          turno: 2,
          campo: 'insumo' as CampoGrilla,
          insumoId: insumo.id,
        },
      },
    ]),
    { label: 'Amasado 1ra', obtener: (item) => valorTurnoMensual(item, 1, 'amasado', item.planilla.amasado1), vivo: (item) => turnoMensualVivo(item, 1).amasado, decimales: 2, editable: { turno: 1, campo: 'amasado' } },
    { label: 'Amasado 2da', obtener: (item) => valorTurnoMensual(item, 2, 'amasado', item.planilla.amasado2), vivo: (item) => turnoMensualVivo(item, 2).amasado, decimales: 2, editable: { turno: 2, campo: 'amasado' } },
    { label: 'Masa queda 1ra', obtener: (item) => valorTurnoMensual(item, 1, 'masa_queda'), vivo: (item) => turnoMensualVivo(item, 1).masa_queda, decimales: 2, editable: { turno: 1, campo: 'masaQueda' } },
    { label: 'Masa ocupada 1ra', obtener: (item) => valorTurnoMensual(item, 1, 'masa_ocupa'), vivo: (item) => turnoMensualVivo(item, 1).masa_ocupa, decimales: 2, editable: { turno: 1, campo: 'masaOcupa' } },
    { label: 'Masa queda 2da', obtener: (item) => valorTurnoMensual(item, 2, 'masa_queda', item.planilla.masa_sobrante), vivo: (item) => turnoMensualVivo(item, 2).masa_queda, decimales: 2, editable: { turno: 2, campo: 'masaQueda' } },
    { label: 'Masa ocupada 2da', obtener: (item) => valorTurnoMensual(item, 2, 'masa_ocupa', item.planilla.masa_ocupada), vivo: (item) => turnoMensualVivo(item, 2).masa_ocupa, decimales: 2, editable: { turno: 2, campo: 'masaOcupa' } },
    { label: 'Panaderos 1ra', obtener: (item) => valorTurnoMensual(item, 1, 'panaderos'), vivo: (item) => turnoMensualVivo(item, 1).panaderos, decimales: 0, editable: { turno: 1, campo: 'panaderos' } },
    { label: 'Panaderos 2da', obtener: (item) => valorTurnoMensual(item, 2, 'panaderos'), vivo: (item) => turnoMensualVivo(item, 2).panaderos, decimales: 0, editable: { turno: 2, campo: 'panaderos' } },
    { label: 'Raciones 1ra', obtener: (item) => valorTurnoMensual(item, 1, 'pan_racion'), vivo: (item) => turnoMensualVivo(item, 1).pan_racion, decimales: 2, editable: { turno: 1, campo: 'panRacion' } },
    { label: 'Raciones 2da', obtener: (item) => valorTurnoMensual(item, 2, 'pan_racion', item.planilla.pan_racion), vivo: (item) => turnoMensualVivo(item, 2).pan_racion, decimales: 2, editable: { turno: 2, campo: 'panRacion' } },
    { label: 'Cacho 1ra', obtener: (item) => valorTurnoMensual(item, 1, 'cacho'), vivo: (item) => turnoMensualVivo(item, 1).cacho, decimales: 2, editable: { turno: 1, campo: 'cacho' } },
    { label: 'Cacho 2da', obtener: (item) => valorTurnoMensual(item, 2, 'cacho', item.planilla.cacho), vivo: (item) => turnoMensualVivo(item, 2).cacho, decimales: 2, editable: { turno: 2, campo: 'cacho' } },
    ...repartosGrilla.flatMap((reparto) => [
      {
        label: `Rep. ${reparto.nombre} 1ra`,
        obtener: (item: ResumenMensualDia) =>
          item.turnos[1]?.repartos?.[normalizar(reparto.nombre)] || 0,
        vivo: (item: ResumenMensualDia) =>
          turnoMensualVivo(item, 1).repartos[normalizar(reparto.nombre)] || 0,
        decimales: 2,
        editable: {
          turno: 1,
          campo: 'reparto' as CampoGrilla,
          repartoId: reparto.id,
        },
      },
      {
        label: `Rep. ${reparto.nombre} 2da`,
        obtener: (item: ResumenMensualDia) =>
          item.turnos[2]?.repartos?.[normalizar(reparto.nombre)] || 0,
        vivo: (item: ResumenMensualDia) =>
          turnoMensualVivo(item, 2).repartos[normalizar(reparto.nombre)] || 0,
        decimales: 2,
        editable: {
          turno: 2,
          campo: 'reparto' as CampoGrilla,
          repartoId: reparto.id,
        },
      },
      {
        label: `Total ${reparto.nombre}`,
        obtener: (item: ResumenMensualDia) =>
          (item.turnos[1]?.repartos?.[normalizar(reparto.nombre)] || 0) +
          (item.turnos[2]?.repartos?.[normalizar(reparto.nombre)] || 0),
        vivo: (item: ResumenMensualDia) =>
          (turnoMensualVivo(item, 1).repartos[normalizar(reparto.nombre)] || 0) +
          (turnoMensualVivo(item, 2).repartos[normalizar(reparto.nombre)] || 0),
        decimales: 2,
      },
    ]),
    { label: '+ Productos rinde 1ra', obtener: (item) => valorTurnoMensual(item, 1, 'otroskg'), vivo: (item) => turnoMensualVivo(item, 1).otroskg, decimales: 2, editable: { turno: 1, campo: 'productos' } },
    { label: '+ Productos rinde 2da', obtener: (item) => valorTurnoMensual(item, 2, 'otroskg'), vivo: (item) => turnoMensualVivo(item, 2).otroskg, decimales: 2, editable: { turno: 2, campo: 'productos' } },
    { label: '+ Otros 1ra', obtener: (item) => valorTurnoMensual(item, 1, 'merma'), vivo: (item) => turnoMensualVivo(item, 1).merma, decimales: 2, editable: { turno: 1, campo: 'merma' } },
    { label: '+ Otros 2da', obtener: (item) => valorTurnoMensual(item, 2, 'merma'), vivo: (item) => turnoMensualVivo(item, 2).merma, decimales: 2, editable: { turno: 2, campo: 'merma' } },
    { label: 'KPAN 1ra', obtener: (item) => valorTurnoMensual(item, 1, 'pan_sobra'), vivo: (item) => turnoMensualVivo(item, 1).pan_sobra, decimales: 2, editable: { turno: 1, campo: 'panSobrante' } },
    { label: 'KPAN 2da', obtener: (item) => valorTurnoMensual(item, 2, 'pan_sobra', item.planilla.pan_sobra), vivo: (item) => turnoMensualVivo(item, 2).pan_sobra, decimales: 2, editable: { turno: 2, campo: 'panSobrante' } },
  ];

  const gruposFilasMensuales = filasMensuales.reduce<
    { seccion: string; filas: FilaMensual[] }[]
  >((grupos, fila) => {
    const seccion = seccionFilaMensual(fila.label);
    const ultimo = grupos[grupos.length - 1];

    if (ultimo?.seccion === seccion) {
      ultimo.filas.push(fila);
    } else {
      grupos.push({ seccion, filas: [fila] });
    }

    return grupos;
  }, []);

  useEffect(() => {
    if (!focoGrillaPendiente) return;

    const timeout = window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        `input[data-grilla-fila="${focoGrillaPendiente.fila}"][data-grilla-columna="${focoGrillaPendiente.dia}"]`
      );

      if (input) {
        input.focus();
        input.select();
        setFocoGrillaPendiente(null);
      }
    }, 80);

    return () => window.clearTimeout(timeout);
  }, [focoGrillaPendiente, turnoSeleccionadoId, fecha]);

  if (cargandoTurnos) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-lg border border-[#4B2818]/15 bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-[#A51F2B]" />
        <span className="ml-3 font-black text-[#4B2818]">
          Cargando turnos...
        </span>
      </div>
    );
  }

  if (turnosConfigurados.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-black">No hay turnos activos</h1>
        <p className="mt-2 text-sm font-semibold">
          Agrega o activa turnos en Configuración → Empresa para crear jornadas
          de rinde.
        </p>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 pb-12"
      onKeyDown={moverConEnter}
      onWheelCapture={evitarScrollCasillaNumero}
    >
      <header className="flex flex-col justify-between gap-4 border-b border-[#4B2818]/15 pb-5 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2 text-[#A51F2B]">
            <Wheat className="h-5 w-5" />
            <span className="text-xs font-black uppercase tracking-wide">
              Producción diaria
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-black text-[#2A1710]">
            Evaluación de rinde por turno
          </h1>
          <p className="mt-1 text-sm font-semibold text-[#4B2818]/65">
            Las jornadas se generan desde los turnos activos configurados en la empresa.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="grid gap-1 text-xs font-bold text-[#4B2818]">
              Mes
              <input
                type="month"
                value={`${anioMes}-${String(mesSeleccionado).padStart(2, '0')}`}
                onChange={(event) => {
                  if (event.target.value) {
                    setFecha(`${event.target.value}-01`);
                  }
                  limpiarTurno();
                }}
                className="h-10 rounded-md border border-[#4B2818]/20 bg-white px-3 font-bold"
              />
            </label>
            <p className="mt-1 text-xs font-black capitalize text-[#A51F2B]">
              {nombreMes(fecha)}
            </p>
          </div>
          <button
            type="button"
            onClick={limpiarTurno}
            title="Limpiar turno"
            className="grid h-10 w-10 place-items-center rounded-md border border-[#4B2818]/20 bg-white text-[#4B2818] transition hover:bg-[#FFF3DF]"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {mensaje && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
          {mensaje}
        </div>
      )}

      <section className="hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-4 py-3">
          <div>
            <h2 className="font-black text-[#2A1710]">Resumen del dia</h2>
            {resumenDia?.turno && (
              <p className="text-xs font-semibold text-[#4B2818]/60">
                Turnos registrados: {resumenDia.turno}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[260px_1fr]">
          <div className={`rounded-md border p-5 ${colorRindeGeneral}`}>
            <p className="text-xs font-black uppercase opacity-75">
              Rinde general
            </p>
            <p className="mt-2 text-5xl font-black leading-none">
              {resumenDia ? numeroDia(resumenDia.rinde_por_saco) : '--'}
            </p>
            <p className="mt-2 text-xs font-bold uppercase opacity-75">
              {resumenDia ? estadoRindeGeneral : 'Sin datos'}
            </p>
            <p className="mt-2 text-xs font-bold opacity-75">
              Kilos totales / amasado para rinde
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Total vaciado', resumenDia ? `${numeroDia(resumenDia.quintal_total)} qq` : '--'],
            ['Amasado registrado', resumenDia ? `${numeroDia(resumenDia.amasado_total)} sacos` : '--'],
            ['Ajuste masa', resumenDia ? `${resumenDia.ajuste_masa >= 0 ? '+' : ''}${numeroDia(resumenDia.ajuste_masa)} sacos` : '--'],
            ['Amasado para rinde', resumenDia ? `${numeroDia(resumenDia.sacos_ajustados)} sacos` : '--'],
            ['Masa ocupada', resumenDia ? numeroDia(resumenDia.masa_ocupada) : '--'],
            ['Masa queda', resumenDia ? numeroDia(resumenDia.masa_sobrante) : '--'],
            ['Kilos totales', resumenDia ? `${numeroDia(resumenDia.kilos_producidos)} kg` : '--'],
            ['Pan sobrante', resumenDia ? `${numeroDia(resumenDia.pan_sobra)} kg` : '--'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-[#4B2818]/10 p-3">
              <p className="text-[11px] font-black uppercase text-[#4B2818]/55">
                {label}
              </p>
              <p className="mt-1 text-lg font-black text-[#2A1710]">{value}</p>
            </div>
          ))}
          </div>
        </div>

        <div className="grid gap-2 border-t border-[#4B2818]/10 px-4 py-3 md:grid-cols-4">
          {[
            ['Pan racion', resumenDia ? `${numeroDia(resumenDia.pan_racion)} kg` : '--'],
            ['Repartos', resumenDia ? `${numeroDia(resumenDia.turnos.reduce((total, item) => total + item.reparto, 0))} kg` : '--'],
            ['Productos rinde', resumenDia ? `${numeroDia(resumenDia.turnos.reduce((total, item) => total + item.otroskg, 0))} kg` : '--'],
            ['Merma', resumenDia ? `${numeroDia(resumenDia.merma)} kg` : '--'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between rounded-md bg-[#FFF3DF]/60 px-3 py-2 text-sm">
              <span className="font-bold text-[#4B2818]/65">{label}</span>
              <span className="font-black text-[#2A1710]">{value}</span>
            </div>
          ))}
        </div>

        {resumenDia?.turnos.length ? (
          <div className="divide-y divide-[#4B2818]/10 border-t border-[#4B2818]/10">
            {resumenDia.turnos.map((item) => (
              <div
                key={`${item.turno}-${item.nombre}`}
                className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1.2fr_repeat(8,1fr)] md:items-center"
              >
                <p className="font-black text-[#2A1710]">{item.nombre}</p>
                <p><span className="font-bold text-[#4B2818]/55">Vaciado:</span> {numeroDia(item.quintal)} qq</p>
                <p><span className="font-bold text-[#4B2818]/55">Amasado:</span> {numeroDia(item.amasado)}</p>
                <p><span className="font-bold text-[#4B2818]/55">Panaderos:</span> {numeroDia(item.panaderos, 0)}</p>
                <p><span className="font-bold text-[#4B2818]/55">Ocupa:</span> {numeroDia(item.masa_ocupa)}</p>
                <p><span className="font-bold text-[#4B2818]/55">Queda:</span> {numeroDia(item.masa_queda)}</p>
                <p><span className="font-bold text-[#4B2818]/55">Productos:</span> {numeroDia(item.otroskg)} kg</p>
                <p><span className="font-bold text-[#4B2818]/55">Kilos:</span> {numeroDia(item.kilos)} kg</p>
                <p><span className="font-bold text-[#4B2818]/55">Rinde:</span> {numeroDia(item.rinde)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="border-t border-[#4B2818]/10 px-4 py-3 text-sm font-semibold text-[#4B2818]/55">
            No hay turnos guardados para esta fecha.
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-1 rounded-lg border border-[#4B2818]/15 bg-white p-1">
        {turnosConfigurados.map((opcion) => (
          <button
            key={opcion.id}
            type="button"
            onClick={() => cambiarTurnoSeleccionado(opcion.id)}
            className={`h-10 rounded-md px-5 text-sm font-black transition ${
              turnoSeleccionadoId === opcion.id
                ? 'bg-[#2A1710] text-white'
                : 'text-[#4B2818] hover:bg-[#FFF3DF]'
            }`}
          >
            {opcion.nombre}
            {(opcion.hora_inicio || opcion.hora_fin) && (
              <span className="ml-2 text-[11px] opacity-70">
                {horaCorta(opcion.hora_inicio)} - {horaCorta(opcion.hora_fin)}
              </span>
            )}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-4 py-3">
          <div>
            <h2 className="font-black capitalize text-[#2A1710]">
              Planilla mensual de rinde - {nombreMes(fecha)}
            </h2>
            <p className="text-xs font-semibold text-[#4B2818]/60">
              Vista tipo Excel: conceptos hacia abajo y todos los dias del mes
              hacia el lado.
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#4B2818]">
            {Object.keys(resumenMensual).length} dias con datos
          </span>
        </div>

        <div className="grid gap-3 border-b border-[#4B2818]/10 p-4 lg:grid-cols-[1.5fr_1fr]">
          <label className="grid gap-1.5 text-xs font-bold text-[#4B2818]">
            Mayordomo responsable
            {tablaFuncionariosDisponible ? (
              <select
                value={responsable}
                onChange={(event) => setResponsable(event.target.value)}
                className="h-10 rounded-md border border-[#4B2818]/20 bg-white px-3 text-sm font-bold outline-none focus:border-[#A51F2B]"
              >
                <option value="">Seleccionar mayordomo</option>
                {mayordomos.map((funcionario) => (
                  <option key={funcionario.id} value={funcionario.nombre_completo}>
                    {funcionario.nombre_completo}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={responsable}
                onChange={(event) => setResponsable(event.target.value)}
                placeholder="Ingreso temporal hasta crear funcionarios"
                className="h-10 rounded-md border border-amber-300 bg-amber-50 px-3 text-sm font-bold outline-none focus:border-[#A51F2B]"
              />
            )}
          </label>

          <label className="grid gap-1.5 text-xs font-bold text-[#4B2818]">
            Observaciones
            <input
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
              className="h-10 rounded-md border border-[#4B2818]/20 px-3 text-sm font-semibold outline-none focus:border-[#A51F2B]"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 w-[118px] min-w-[118px] border-b border-r-4 border-[#A51F2B] bg-[#FFF3DF]" />
                <th className="sticky left-[118px] z-10 min-w-[190px] border-b border-r border-[#4B2818]/15 bg-[#2A1710] px-3 py-1 text-left text-xs font-black uppercase text-white">
                  Dia
                </th>
                {diasMes.map((dia) => {
                  const fechaColumna = fechaDiaMes(dia);
                  const domingo = esDomingo(fechaColumna);

                  return (
                    <th
                      key={`semana-${dia}`}
                      className={`min-w-[74px] border-b border-r border-[#4B2818]/10 px-2 py-1 text-center text-xs font-black ${
                        domingo
                          ? 'bg-amber-200 text-amber-950'
                          : fechaColumna === fecha
                            ? 'bg-[#A51F2B] text-white'
                            : 'bg-[#FFF3DF] text-[#4B2818]'
                      }`}
                    >
                      {letraDiaSemana(fechaColumna)}
                    </th>
                  );
                })}
              </tr>
              <tr>
                <th className="sticky left-0 z-20 w-[118px] min-w-[118px] border-b border-r-4 border-[#A51F2B] bg-[#FFF3DF]" />
                <th className="sticky left-[118px] z-10 min-w-[190px] border-b border-r border-[#4B2818]/15 bg-[#2A1710] px-3 py-2 text-left text-xs font-black uppercase text-white">
                  Concepto
                </th>
                {diasMes.map((dia) => {
                  const fechaColumna = fechaDiaMes(dia);
                  const domingo = esDomingo(fechaColumna);

                  return (
                    <th
                      key={dia}
                      className={`min-w-[74px] border-b border-r border-[#4B2818]/10 px-2 py-2 text-center text-xs font-black ${
                        domingo
                          ? 'bg-amber-200 text-amber-950'
                          : fechaColumna === fecha
                            ? 'bg-[#A51F2B] text-white'
                            : 'bg-[#FFF3DF] text-[#4B2818]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (fechaColumna !== fecha) {
                            guardarBorradorTurnoActual();
                            cargaTurnoId.current += 1;
                            setTurnoCargadoClave('');
                            setCeldaEditable(null);
                            limpiarTurno();
                          }
                          setFecha(fechaColumna);
                        }}
                        className="block w-full"
                      >
                        {etiquetaDiaMes(dia)}
                      </button>
                      <button
                        type="button"
                        title="Editar columna"
                        onClick={() => {
                          const primeraFila = primeraFilaEditableGrilla();
                          const filaInicial = filasMensuales[primeraFila];
                          const diaColumna = Number(fechaColumna.slice(-2));

                          setColumnaEditable(fechaColumna);
                          if (primeraFila === -1 || !filaInicial?.editable) {
                            setCeldaEditable(null);
                            return;
                          }

                          seleccionarCeldaGrilla(
                            fechaColumna,
                            filaInicial.editable.turno
                          );
                          setCeldaEditable({
                            dia: diaColumna,
                            fila: primeraFila,
                          });
                          setFocoGrillaPendiente({
                            dia: diaColumna,
                            fila: primeraFila,
                          });
                        }}
                        className={`mx-auto mt-1 grid h-5 w-5 place-items-center rounded-full transition ${
                          columnaEditable === fechaColumna
                            ? 'bg-[#A51F2B] text-white'
                            : 'bg-white/80 text-[#4B2818] hover:bg-white'
                        }`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            {gruposFilasMensuales.map((grupo) => (
              <tbody
                key={grupo.seccion}
                className="border-t-4 border-[#A51F2B]"
              >
                {grupo.filas.map((fila, indice) => {
                const indiceFilaMensual = filasMensuales.findIndex(
                  (item) => item.label === fila.label
                );
                const filaResumen = [
                  'Quintales vaciados',
                  'KILOS',
                  'RINDE',
                  'Total amasado',
                  'Masa 1ra',
                  'Masa 2da',
                  'Kilos 1ra',
                  'Kilos 2da',
                  'Total kilos',
                  'Rinde 1ra',
                  'Rinde 2da',
                  'Total panaderos',
                ].includes(fila.label) ||
                  repartosGrilla.some(
                    (reparto) =>
                      normalizar(fila.label) ===
                      normalizar(`Total ${reparto.nombre}`)
                  );
                const colorFilaBase = filaResumen
                  ? 'bg-[#FFF3DF]'
                  : 'bg-white';

                return (
                <tr
                  key={fila.label}
                  className={colorFilaBase}
                >
                  {indice === 0 && (
                    <th
                      rowSpan={grupo.filas.length}
                      className="sticky left-0 z-20 w-[118px] min-w-[118px] border-r-4 border-[#A51F2B] bg-[#FFF3DF] px-2 py-2 text-left align-middle shadow-sm"
                    >
                      <div className="flex h-full min-h-[76px] items-center gap-2">
                        <span className="font-serif text-6xl leading-none text-[#A51F2B]">
                          {'{'}
                        </span>
                        <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-black uppercase tracking-wide text-[#2A1710]">
                          {grupo.seccion}
                        </span>
                      </div>
                    </th>
                  )}
                  <th className={`sticky left-[118px] z-10 min-w-[190px] border-b border-r border-[#4B2818]/10 px-3 py-2 text-left text-xs font-black uppercase text-[#2A1710] ${colorFilaBase}`}>
                    {fila.label}
                  </th>
                  {diasMes.map((dia) => {
                    const fechaCelda = fechaDiaMes(dia);
                    const esDiaActivo = fechaCelda === fecha;
                    const domingo = esDomingo(fechaCelda);
                    const valorCelda = valorCeldaMensual(fechaCelda, fila);
                    const etiquetaFila = normalizar(fila.label);
                    const esFilaRinde =
                      etiquetaFila === 'rinde' ||
                      etiquetaFila === 'rinde 1ra' ||
                      etiquetaFila === 'rinde 2da';
                    const esTurnoActivo =
                      !fila.editable?.turno ||
                      fila.editable.turno === turnoSeleccionado?.orden;
                    const esEditable = Boolean(
                      fila.editable &&
                      esDiaActivo &&
                      columnaEditable === fechaCelda &&
                      esTurnoActivo &&
                      celdaEditable?.dia === dia &&
                      celdaEditable?.fila === indiceFilaMensual
                    );

                    return (
                      <td
                        key={`${fila.label}-${dia}`}
                        className={`border-b border-r border-[#4B2818]/10 p-0 text-right font-bold text-[#2A1710] ${colorFilaBase} ${
                          domingo ? '!bg-amber-50' : ''
                        } ${esDiaActivo ? '!bg-[#A51F2B]/10' : ''} ${
                          esFilaRinde ? colorCeldaRinde(valorCelda) : ''
                        }`}
                      >
                        {fila.editable?.campo === 'agregarInsumo' ? (
                          <button
                            type="button"
                            onClick={() => abrirModuloInsumos(fechaCelda)}
                            className="inline-flex h-9 w-[74px] items-center justify-end gap-1 px-2 text-right font-bold transition hover:bg-[#FFF3DF]"
                            title="Agregar insumos"
                          >
                            <Plus className="h-3 w-3 text-[#A51F2B]" />
                          </button>
                        ) : fila.editable?.campo === 'productos' ? (
                          <button
                            type="button"
                            onClick={() =>
                              abrirModuloProductosRinde(
                                fechaCelda,
                                fila.editable?.turno
                              )
                            }
                            className="inline-flex h-9 w-[74px] items-center justify-end gap-1 px-2 text-right font-bold transition hover:bg-[#FFF3DF]"
                            title="Abrir productos producidos"
                          >
                            <span>{valorMes(dia, fila, fila.decimales)}</span>
                            {esDiaActivo && esTurnoActivo && (
                              <Plus className="h-3 w-3 text-[#A51F2B]" />
                            )}
                          </button>
                        ) : fila.editable?.campo === 'merma' ? (
                          <button
                            type="button"
                            onClick={() =>
                              abrirModuloOtros(fechaCelda, fila.editable?.turno)
                            }
                            className="inline-flex h-9 w-[74px] items-center justify-end gap-1 px-2 text-right font-bold transition hover:bg-[#FFF3DF]"
                            title="Agregar otros kilos"
                          >
                            <span>{valorMes(dia, fila, fila.decimales)}</span>
                            {esDiaActivo && esTurnoActivo && (
                              <Plus className="h-3 w-3 text-[#A51F2B]" />
                            )}
                          </button>
                        ) : esEditable && fila.editable ? (
                          <input
                            type="number"
                            data-grilla-fila={indiceFilaMensual}
                            data-grilla-columna={dia}
                            min="0"
                            step={fila.decimales === 0 ? '1' : '0.01'}
                            value={
                              valorEditableGrilla(
                                fila.editable.campo,
                                fila.editable.insumoId,
                                fila.editable.repartoId,
                                fila.editable.productoTurnoId
                              ) || ''
                            }
                            onChange={(event) =>
                              cambiarCampoGrilla(
                                fila.editable!.campo,
                                Number(event.target.value || 0),
                                fila.editable!.insumoId,
                                fila.editable!.repartoId,
                                fila.editable!.productoTurnoId
                              )
                            }
                            onKeyDown={(event) =>
                              moverEnterGrilla(
                                event,
                                fila,
                                indiceFilaMensual,
                                dia
                              )
                            }
                            className="h-9 w-[74px] border-0 bg-white px-2 text-right text-sm font-black outline-none ring-1 ring-[#A51F2B]/25 focus:ring-2 focus:ring-[#A51F2B]"
                          />
                        ) : fila.editable ? (
                          <button
                            type="button"
                            onClick={() => {
                              seleccionarCeldaGrilla(
                                fechaCelda,
                                fila.editable?.turno
                              );
                              setCeldaEditable({
                                dia,
                                fila: indiceFilaMensual,
                              });
                            }}
                            className="h-9 w-[74px] px-2 text-right font-bold transition hover:bg-[#FFF3DF]"
                          >
                            {valorMes(dia, fila, fila.decimales)}
                          </button>
                        ) : (
                          <span className="block h-9 w-[74px] px-2 py-2">
                            {valorMes(dia, fila, fila.decimales)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                );
              })}
              </tbody>
            ))}
          </table>
        </div>

        {moduloInsumosAbierto && (
          <div className="border-t border-[#4B2818]/10 bg-[#FFFDF8] p-4">
            <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-4 py-3">
                <div>
                  <h2 className="font-black text-[#2A1710]">
                    Agregar insumos
                  </h2>
                  <p className="text-xs font-semibold text-[#4B2818]/60">
                    Incorpora harinas o insumos a la seccion Insumos de la
                    grilla mensual.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModuloInsumosAbierto(false)}
                  className="rounded-md border border-[#4B2818]/20 px-3 py-2 text-xs font-black text-[#4B2818] transition hover:bg-white"
                >
                  Cerrar
                </button>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-[#4B2818]/10 px-4 py-3">
                <select
                  value={harinaSeleccionadaId}
                  onChange={(event) =>
                    setHarinaSeleccionadaId(event.target.value)
                  }
                  className="h-9 min-w-0 flex-1 rounded-md border border-[#4B2818]/20 bg-white px-3 text-sm font-bold text-[#2A1710] outline-none focus:border-[#A51F2B] sm:max-w-sm"
                >
                  <option value="">Seleccionar insumo</option>
                  {productosRinde
                    .filter(
                      (producto) =>
                        !insumos.some(
                          (item) => item.producto_id === producto.id
                        )
                    )
                    .map((producto) => (
                      <option key={producto.id} value={producto.id}>
                        {producto.nombre}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={agregarHarinaGrilla}
                  disabled={!harinaSeleccionadaId}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-[#2A1710] px-3 text-xs font-black text-white transition hover:bg-[#A51F2B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Insumo
                </button>
              </div>

              {insumos.length === 0 ? (
                <p className="px-4 py-5 text-sm font-semibold text-[#4B2818]/55">
                  Aun no hay insumos adicionales en la grilla.
                </p>
              ) : (
                <div className="grid gap-2 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
                  {insumos.map((insumo) => (
                    <div
                      key={insumo.id}
                      className="rounded-md border border-[#4B2818]/10 bg-[#FFFDF8] px-3 py-2 text-sm font-bold text-[#4B2818]"
                    >
                      {insumo.nombre}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {moduloProductosRindeAbierto && turnoSeleccionado && (
          <div className="border-t border-[#4B2818]/10 bg-[#F6FFF7] p-4">
            <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-4 py-3">
                <div>
                  <h2 className="font-black text-[#2A1710]">
                    Productos producidos para rinde
                  </h2>
                  <p className="text-xs font-semibold text-[#4B2818]/60">
                    {fecha} - {turnoSeleccionado.nombre}. La grilla mensual solo
                    muestra el total.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModuloProductosRindeAbierto(false)}
                  className="rounded-md border border-[#4B2818]/20 px-3 py-2 text-xs font-black text-[#4B2818] transition hover:bg-white"
                >
                  Cerrar
                </button>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-[#4B2818]/10 px-4 py-3">
                <select
                  value={productoSeleccionadoId}
                  onChange={(event) =>
                    setProductoSeleccionadoId(event.target.value)
                  }
                  className="h-9 min-w-0 flex-1 rounded-md border border-[#4B2818]/20 bg-white px-3 text-sm font-bold text-[#2A1710] outline-none focus:border-[#A51F2B] sm:max-w-sm"
                >
                  <option value="">Seleccionar producto</option>
                  {productosPanaderia
                    .filter(
                      (producto) =>
                        !productosTurno.some(
                          (item) => item.producto_id === producto.id
                        )
                    )
                    .map((producto) => (
                      <option key={producto.id} value={producto.id}>
                        {producto.nombre}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={agregarProductoTurno}
                  disabled={!productoSeleccionadoId}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-[#2A1710] px-3 text-xs font-black text-white transition hover:bg-[#A51F2B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Producto
                </button>
              </div>

              {productosTurno.length === 0 ? (
                <p className="px-4 py-5 text-sm font-semibold text-[#4B2818]/55">
                  Agrega productos producidos solo cuando correspondan a este
                  dia y turno.
                </p>
              ) : (
                <div className="divide-y divide-[#4B2818]/10">
                  {productosTurno.map((producto) => (
                    <div
                      key={producto.id}
                      className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_150px_40px] sm:items-center"
                    >
                      <input
                        value={producto.nombre}
                        readOnly
                        className="h-9 rounded-md border border-[#4B2818]/15 bg-gray-50 px-3 font-bold text-[#4B2818]/70 outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label={`Kilos ${producto.nombre}`}
                        value={producto.kilos || ''}
                        onChange={(event) => {
                          marcarTurnoActualComoCargado();
                          setProductosTurno((actuales) =>
                            actuales.map((item) =>
                              item.id === producto.id
                                ? {
                                    ...item,
                                    kilos: Number(event.target.value || 0),
                                  }
                                : item
                            )
                          );
                        }}
                        className="h-9 rounded-md border border-[#4B2818]/15 px-3 text-right font-bold outline-none focus:border-[#A51F2B]"
                      />
                      <button
                        type="button"
                        title="Quitar producto"
                        onClick={() => {
                          marcarTurnoActualComoCargado();
                          setProductosTurno((actuales) =>
                            actuales.filter((item) => item.id !== producto.id)
                          );
                        }}
                        className="grid h-8 w-8 place-items-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-[#4B2818]/10 bg-[#FFF3DF]/60 px-4 py-3 text-right text-sm font-black text-[#2A1710]">
                Total productos para rinde: {kilosProductosTurno.toFixed(2)} kg
              </div>
            </section>
          </div>
        )}

        {moduloOtrosAbierto && turnoSeleccionado && (
          <div className="border-t border-[#4B2818]/10 bg-[#FFFDF8] p-4">
            <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-4 py-3">
                <div>
                  <h2 className="font-black text-[#2A1710]">
                    Otros kilos para rinde
                  </h2>
                  <p className="text-xs font-semibold text-[#4B2818]/60">
                    {fecha} - {turnoSeleccionado.nombre}. Selecciona clientes de
                    reparto panaderia y productos de familia pan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModuloOtrosAbierto(false)}
                  className="rounded-md border border-[#4B2818]/20 px-3 py-2 text-xs font-black text-[#4B2818] transition hover:bg-white"
                >
                  Cerrar
                </button>
              </div>

              <div className="grid gap-2 border-b border-[#4B2818]/10 px-4 py-3 lg:grid-cols-[1fr_1fr_auto]">
                <select
                  value={otroClienteSeleccionadoId}
                  onChange={(event) =>
                    setOtroClienteSeleccionadoId(event.target.value)
                  }
                  className="h-9 min-w-0 rounded-md border border-[#4B2818]/20 bg-white px-3 text-sm font-bold text-[#2A1710] outline-none focus:border-[#A51F2B]"
                >
                  <option value="">Cliente panaderia</option>
                  {clientesPanaderia.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.sigla || cliente.razon_social}
                    </option>
                  ))}
                </select>
                <select
                  value={otroProductoSeleccionadoId}
                  onChange={(event) =>
                    setOtroProductoSeleccionadoId(event.target.value)
                  }
                  className="h-9 min-w-0 rounded-md border border-[#4B2818]/20 bg-white px-3 text-sm font-bold text-[#2A1710] outline-none focus:border-[#A51F2B]"
                >
                  <option value="">Producto familia pan</option>
                  {productosFamiliaPan.map((producto) => (
                    <option key={producto.id} value={producto.id}>
                      {producto.nombre}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={agregarOtroTurno}
                  disabled={
                    !otroClienteSeleccionadoId || !otroProductoSeleccionadoId
                  }
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#2A1710] px-3 text-xs font-black text-white transition hover:bg-[#A51F2B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Agregar
                </button>
              </div>

              {otrosTurno.length === 0 ? (
                <p className="px-4 py-5 text-sm font-semibold text-[#4B2818]/55">
                  Agrega otros kilos solo cuando correspondan a este dia y turno.
                </p>
              ) : (
                <div className="divide-y divide-[#4B2818]/10">
                  {otrosTurno.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-2 px-4 py-3 lg:grid-cols-[1fr_1fr_150px_40px] lg:items-center"
                    >
                      <input
                        value={item.cliente_nombre}
                        readOnly
                        className="h-9 rounded-md border border-[#4B2818]/15 bg-gray-50 px-3 font-bold text-[#4B2818]/70 outline-none"
                      />
                      <input
                        value={item.producto_nombre}
                        readOnly
                        className="h-9 rounded-md border border-[#4B2818]/15 bg-gray-50 px-3 font-bold text-[#4B2818]/70 outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label={`Kilos ${item.cliente_nombre}`}
                        value={item.kilos || ''}
                        onChange={(event) =>
                          actualizarOtrosTurno(
                            otrosTurno.map((otro) =>
                              otro.id === item.id
                                ? {
                                    ...otro,
                                    kilos: Number(event.target.value || 0),
                                  }
                                : otro
                            )
                          )
                        }
                        className="h-9 rounded-md border border-[#4B2818]/15 px-3 text-right font-bold outline-none focus:border-[#A51F2B]"
                      />
                      <button
                        type="button"
                        title="Quitar"
                        onClick={() =>
                          actualizarOtrosTurno(
                            otrosTurno.filter((otro) => otro.id !== item.id)
                          )
                        }
                        className="grid h-8 w-8 place-items-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-[#4B2818]/10 bg-[#FFF3DF]/60 px-4 py-3 text-right text-sm font-black text-[#2A1710]">
                Total otros para rinde: {kilosOtrosTurno.toFixed(2)} kg
              </div>
            </section>
          </div>
        )}
      </section>

      <section className="hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-4 py-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-[#A51F2B]" />
            <div>
              <h2 className="font-black text-[#2A1710]">
                Linea de rinde estilo Excel
              </h2>
              <p className="text-xs font-semibold text-[#4B2818]/60">
                Un turno en una sola fila: vaciado, amasado, masas, repartos,
                productos, insumos y resultado.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!tablaFuncionariosDisponible && (
              <button
                type="button"
                onClick={() =>
                  setRepartos((actuales) => [
                    ...actuales,
                    {
                      id: `temporal-${Date.now()}`,
                      nombre: `Reparto ${actuales.length + 1}`,
                      kilos: 0,
                    },
                  ])
                }
                className="inline-flex h-9 items-center gap-2 rounded-md bg-[#2A1710] px-3 text-xs font-black text-white transition hover:bg-[#A51F2B]"
              >
                <Plus className="h-4 w-4" />
                Reparto
              </button>
            )}
            <select
              value={productoSeleccionadoId}
              onChange={(event) => setProductoSeleccionadoId(event.target.value)}
              className="h-9 min-w-0 rounded-md border border-[#4B2818]/20 bg-white px-3 text-sm font-bold text-[#2A1710] outline-none focus:border-[#A51F2B]"
            >
              <option value="">Producto para rinde</option>
              {productosPanaderia
                .filter(
                  (producto) =>
                    !productosTurno.some(
                      (item) => item.producto_id === producto.id
                    )
                )
                .map((producto) => (
                  <option key={producto.id} value={producto.id}>
                    {producto.nombre}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={agregarProductoTurno}
              disabled={!productoSeleccionadoId}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[#2A1710] px-3 text-xs font-black text-white transition hover:bg-[#A51F2B] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Producto
            </button>
          </div>
        </div>

        <div className="grid gap-3 border-b border-[#4B2818]/10 p-4 lg:grid-cols-[1.5fr_1fr]">
          <label className="grid gap-1.5 text-xs font-bold text-[#4B2818]">
            Mayordomo responsable
            {tablaFuncionariosDisponible ? (
              <select
                value={responsable}
                onChange={(event) => setResponsable(event.target.value)}
                className="h-10 rounded-md border border-[#4B2818]/20 bg-white px-3 text-sm font-bold outline-none focus:border-[#A51F2B]"
              >
                <option value="">Seleccionar mayordomo</option>
                {mayordomos.map((funcionario) => (
                  <option key={funcionario.id} value={funcionario.nombre_completo}>
                    {funcionario.nombre_completo}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={responsable}
                onChange={(event) => setResponsable(event.target.value)}
                placeholder="Ingreso temporal hasta crear funcionarios"
                className="h-10 rounded-md border border-amber-300 bg-amber-50 px-3 text-sm font-bold outline-none focus:border-[#A51F2B]"
              />
            )}
          </label>

          <label className="grid gap-1.5 text-xs font-bold text-[#4B2818]">
            Observaciones
            <input
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
              className="h-10 rounded-md border border-[#4B2818]/20 px-3 text-sm font-semibold outline-none focus:border-[#A51F2B]"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <div className="flex min-w-max border-b border-[#4B2818]/10">
            <div className="sticky left-0 z-10 grid min-w-[150px] gap-1 border-r border-[#4B2818]/10 bg-[#2A1710] px-3 py-2 text-[10px] font-black uppercase text-white shadow-sm">
              <span>Dia / turno</span>
              <span className="h-8 rounded bg-white/10 px-2 py-1.5 text-sm">
                {fecha.slice(-2)} - {turnoSeleccionado?.nombre}
              </span>
            </div>

            <CampoLinea label="1ra / Quintal" value={quintal} onChange={setQuintal} />
            <CampoLinea
              label="Amasado"
              value={turno.amasado}
              onChange={(valor) => cambiarCampo('amasado', valor)}
            />
            <CampoLinea
              label="Masa queda"
              value={turno.masaQueda}
              onChange={(valor) => cambiarCampo('masaQueda', valor)}
            />
            <CampoLinea
              label="Masa ocupada"
              value={turno.masaOcupa}
              onChange={(valor) => cambiarCampo('masaOcupa', valor)}
            />
            <CampoLinea
              label="Panaderos"
              value={panaderos}
              onChange={setPanaderos}
              step="1"
            />
            <CampoLinea
              label="Raciones"
              value={turno.panRacion}
              onChange={(valor) => cambiarCampo('panRacion', valor)}
            />
            <CampoLinea
              label="Cacho"
              value={turno.cacho || 0}
              onChange={(valor) => cambiarCampo('cacho', valor)}
            />

            {repartos.map((reparto) => (
              <CampoLinea
                key={reparto.id}
                label={reparto.nombre}
                value={reparto.kilos}
                onChange={(valor) =>
                  setRepartos((actuales) =>
                    actuales.map((item) =>
                      item.id === reparto.id ? { ...item, kilos: valor } : item
                    )
                  )
                }
                className="min-w-[118px]"
              />
            ))}

            {productosTurno.map((producto) => (
              <div key={producto.id} className="relative">
                <CampoLinea
                  label={producto.nombre}
                  value={producto.kilos}
                  onChange={(valor) =>
                    setProductosTurno((actuales) =>
                      actuales.map((item) =>
                        item.id === producto.id
                          ? { ...item, kilos: valor }
                          : item
                      )
                    )
                  }
                  className="min-w-[128px] bg-[#F6FFF7]"
                />
                <button
                  type="button"
                  title="Quitar producto"
                  onClick={() =>
                    setProductosTurno((actuales) =>
                      actuales.filter((item) => item.id !== producto.id)
                    )
                  }
                  className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded text-[#4B2818]/45 transition hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}

            <CampoLinea
              label="Otro"
              value={turno.merma || 0}
              onChange={(valor) => cambiarCampo('merma', valor)}
            />
            <CampoLinea
              label="KPAN sobrante"
              value={turno.panSobrante || 0}
              onChange={(valor) => cambiarCampo('panSobrante', valor)}
            />

            {insumos.map((insumo) => (
              <CampoLinea
                key={insumo.id}
                label={insumo.nombre}
                value={insumo.cantidad}
                onChange={(valor) =>
                  setInsumos((actuales) =>
                    actuales.map((item) =>
                      item.id === insumo.id ? { ...item, cantidad: valor } : item
                    )
                  )
                }
                className="min-w-[112px] bg-[#F8FAFC]"
              />
            ))}

            <CeldaResultado
              label="Total repartos"
              value={`${kilosRepartos.toFixed(2)} kg`}
            />
            <CeldaResultado
              label="Productos"
              value={`${kilosProductosTurno.toFixed(2)} kg`}
            />
            <CeldaResultado
              label="Desc. KPAN ant."
              value={`${panSobranteAnterior.toFixed(2)} kg`}
            />
            <CeldaResultado
              label="Kilos"
              value={`${calculo.kilos.toFixed(2)} kg`}
              emphasis
            />
            <CeldaResultado
              label="Amasado calc."
              value={calculo.factorAmasado.toFixed(2)}
              emphasis
            />
            <CeldaResultado
              label="Rinde"
              value={calculo.rinde.toFixed(2)}
              emphasis
            />
          </div>
        </div>

        <div className={`border-t px-4 py-3 text-sm font-black ${colorEstado}`}>
          Estado {turnoSeleccionado?.nombre}: {calculo.estadoRinde}.{' '}
          {panSobranteAnterior > 0
            ? `Descuenta ${panSobranteAnterior.toFixed(2)} kg de pan sobrante del turno anterior.`
            : 'El KPAN sobrante se guarda para descontarlo en el turno siguiente.'}
        </div>
      </section>

      <div className="hidden">
      <section className={`rounded-lg border p-5 ${colorEstado}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase">
              Rinde {turnoSeleccionado?.nombre}
            </p>
            <p className="mt-1 text-4xl font-black">{calculo.rinde.toFixed(2)}</p>
          </div>
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black uppercase">
            {calculo.estadoRinde}
          </span>
        </div>
        <p className="mt-4 text-sm font-bold opacity-75">
          {calculo.kilos.toFixed(2)} kg / {calculo.factorAmasado.toFixed(2)} sacos ajustados
        </p>
        {panSobranteAnterior > 0 && (
          <p className="mt-1 text-xs font-black opacity-75">
            Descuenta {panSobranteAnterior.toFixed(2)} kg de pan sobrante del turno anterior.
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
        <div className="border-b border-[#4B2818]/10 bg-[#FFF3DF] px-4 py-3">
          <h2 className="font-black text-[#2A1710]">Datos del turno</h2>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1.5 text-xs font-bold text-[#4B2818] lg:col-span-2">
            Mayordomo responsable
            {tablaFuncionariosDisponible ? (
              <select
                value={responsable}
                onChange={(event) => setResponsable(event.target.value)}
                className="h-10 rounded-md border border-[#4B2818]/20 bg-white px-3 text-sm font-bold outline-none focus:border-[#A51F2B]"
              >
                <option value="">Seleccionar mayordomo</option>
                {mayordomos.map((funcionario) => (
                  <option key={funcionario.id} value={funcionario.nombre_completo}>
                    {funcionario.nombre_completo}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={responsable}
                onChange={(event) => setResponsable(event.target.value)}
                placeholder="Ingreso temporal hasta crear funcionarios"
                className="h-10 rounded-md border border-amber-300 bg-amber-50 px-3 text-sm font-bold outline-none focus:border-[#A51F2B]"
              />
            )}
            {tablaFuncionariosDisponible && mayordomos.length === 0 && (
              <span className="text-[11px] font-semibold text-amber-700">
                No hay funcionarios activos con cargo mayordomo.
              </span>
            )}
          </label>
          <CampoNumero label="Quintal" value={quintal} onChange={setQuintal} />
          <CampoNumero
            label="Panaderos"
            value={panaderos}
            onChange={setPanaderos}
            step="1"
          />
          <CampoNumero
            label="Amasado (sacos)"
            value={turno.amasado}
            onChange={(valor) => cambiarCampo('amasado', valor)}
          />
          <CampoNumero
            label="Masa ocupa"
            value={turno.masaOcupa}
            onChange={(valor) => cambiarCampo('masaOcupa', valor)}
          />
          <CampoNumero
            label="Masa queda"
            value={turno.masaQueda}
            onChange={(valor) => cambiarCampo('masaQueda', valor)}
          />
          <CampoNumero
            label="Pan ración (kg)"
            value={turno.panRacion}
            onChange={(valor) => cambiarCampo('panRacion', valor)}
          />
          <CampoNumero
            label="Pan sobrante (kg)"
            value={turno.panSobrante || 0}
            onChange={(valor) => cambiarCampo('panSobrante', valor)}
          />
          <CampoNumero
            label="Merma (kg)"
            value={turno.merma || 0}
            onChange={(valor) => cambiarCampo('merma', valor)}
          />
          <label className="grid gap-1.5 text-xs font-bold text-[#4B2818] sm:col-span-2 lg:col-span-4">
            Observaciones del turno
            <textarea
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
              rows={2}
              className="resize-y rounded-md border border-[#4B2818]/20 px-3 py-2 text-sm font-semibold outline-none focus:border-[#A51F2B]"
            />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-4 py-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-[#A51F2B]" />
            <div>
              <h2 className="font-black text-[#2A1710]">Ventas por reparto</h2>
              <p className="text-xs font-semibold text-[#4B2818]/60">
                Kilos entregados durante este turno.
              </p>
            </div>
          </div>
          {!tablaFuncionariosDisponible && (
            <button
              type="button"
              onClick={() =>
                setRepartos((actuales) => [
                  ...actuales,
                  {
                    id: `temporal-${Date.now()}`,
                    nombre: `Reparto ${actuales.length + 1}`,
                    kilos: 0,
                  },
                ])
              }
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[#2A1710] px-3 text-xs font-black text-white transition hover:bg-[#A51F2B]"
            >
              <Plus className="h-4 w-4" />
              Reparto
            </button>
          )}
        </div>
        <div className="divide-y divide-[#4B2818]/10">
          {repartos.map((reparto) => (
            <div
              key={reparto.id}
              className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_160px_40px] sm:items-center"
            >
              <input
                value={reparto.nombre}
                readOnly={tablaFuncionariosDisponible}
                onChange={(event) =>
                  setRepartos((actuales) =>
                    actuales.map((item) =>
                      item.id === reparto.id
                        ? { ...item, nombre: event.target.value }
                        : item
                    )
                  )
                }
                className="h-9 rounded-md border border-[#4B2818]/15 bg-white px-3 font-bold outline-none read-only:bg-gray-50 read-only:text-[#4B2818]/70 focus:border-[#A51F2B]"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                aria-label={`Kilos ${reparto.nombre}`}
                value={reparto.kilos || ''}
                onChange={(event) =>
                  setRepartos((actuales) =>
                    actuales.map((item) =>
                      item.id === reparto.id
                        ? { ...item, kilos: Number(event.target.value || 0) }
                        : item
                    )
                  )
                }
                className="h-9 rounded-md border border-[#4B2818]/15 px-3 text-right font-bold outline-none focus:border-[#A51F2B]"
              />
              {!tablaFuncionariosDisponible && (
                <button
                  type="button"
                  title="Eliminar reparto"
                  onClick={() =>
                    setRepartos((actuales) =>
                      actuales.filter((item) => item.id !== reparto.id)
                    )
                  }
                  className="grid h-8 w-8 place-items-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-[#4B2818]/10 bg-[#FFF3DF]/60 px-4 py-3 text-right text-sm font-black text-[#2A1710]">
          Total repartos: {kilosRepartos.toFixed(2)} kg
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-4 py-3">
          <div>
            <h2 className="font-black text-[#2A1710]">Productos para rinde</h2>
            <p className="text-xs font-semibold text-[#4B2818]/60">
              Productos de panadería producidos en kilos durante este turno.
            </p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <select
              value={productoSeleccionadoId}
              onChange={(event) => setProductoSeleccionadoId(event.target.value)}
              className="h-9 min-w-0 flex-1 rounded-md border border-[#4B2818]/20 bg-white px-3 text-sm font-bold text-[#2A1710] outline-none focus:border-[#A51F2B] sm:w-64"
            >
              <option value="">Seleccionar producto</option>
              {productosPanaderia
                .filter(
                  (producto) =>
                    !productosTurno.some(
                      (item) => item.producto_id === producto.id
                    )
                )
                .map((producto) => (
                  <option key={producto.id} value={producto.id}>
                    {producto.nombre}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={agregarProductoTurno}
              disabled={!productoSeleccionadoId}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[#2A1710] px-3 text-xs font-black text-white transition hover:bg-[#A51F2B] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>
        </div>

        {productosTurno.length === 0 ? (
          <p className="px-4 py-5 text-sm font-semibold text-[#4B2818]/55">
            Agrega productos como Hallulla Integral cuando sus kilos deban sumar al rinde.
          </p>
        ) : (
          <div className="divide-y divide-[#4B2818]/10">
            {productosTurno.map((producto) => (
              <div
                key={producto.id}
                className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_150px_40px] sm:items-center"
              >
                <input
                  value={producto.nombre}
                  readOnly
                  className="h-9 rounded-md border border-[#4B2818]/15 bg-gray-50 px-3 font-bold text-[#4B2818]/70 outline-none"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  aria-label={`Kilos ${producto.nombre}`}
                  value={producto.kilos || ''}
                  onChange={(event) =>
                    setProductosTurno((actuales) =>
                      actuales.map((item) =>
                        item.id === producto.id
                          ? { ...item, kilos: Number(event.target.value || 0) }
                          : item
                      )
                    )
                  }
                  className="h-9 rounded-md border border-[#4B2818]/15 px-3 text-right font-bold outline-none focus:border-[#A51F2B]"
                />
                <button
                  type="button"
                  title="Quitar producto"
                  onClick={() =>
                    setProductosTurno((actuales) =>
                      actuales.filter((item) => item.id !== producto.id)
                    )
                  }
                  className="grid h-8 w-8 place-items-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-[#4B2818]/10 bg-[#FFF3DF]/60 px-4 py-3 text-right text-sm font-black text-[#2A1710]">
          Total productos para rinde: {kilosProductosTurno.toFixed(2)} kg
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-4 py-3">
          <div>
            <h2 className="font-black text-[#2A1710]">Insumos del turno</h2>
            <p className="text-xs font-semibold text-[#4B2818]/60">
              Productos habilitados desde el módulo de Productos.
            </p>
          </div>
        </div>

        {insumos.length === 0 ? (
          <p className="px-4 py-5 text-sm font-semibold text-[#4B2818]/55">
            No hay productos marcados para usar en la planilla de rinde.
          </p>
        ) : (
          <div className="divide-y divide-[#4B2818]/10">
            {insumos.map((insumo) => (
              <div
                key={insumo.id}
                className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_100px_150px_40px] sm:items-center"
              >
                <input
                  value={insumo.nombre}
                  readOnly
                  className="h-9 rounded-md border border-[#4B2818]/15 bg-gray-50 px-3 font-bold text-[#4B2818]/70 outline-none"
                />
                <input
                  value={insumo.unidad}
                  readOnly
                  aria-label={`Unidad ${insumo.nombre || 'insumo'}`}
                  className="h-9 rounded-md border border-[#4B2818]/15 bg-gray-50 px-3 font-bold text-[#4B2818]/70 outline-none"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  aria-label={`Cantidad ${insumo.nombre || 'insumo'}`}
                  value={insumo.cantidad || ''}
                  onChange={(event) =>
                    setInsumos((actuales) =>
                      actuales.map((item) =>
                        item.id === insumo.id
                          ? {
                              ...item,
                              cantidad: Number(event.target.value || 0),
                            }
                          : item
                      )
                    )
                  }
                  className="h-9 rounded-md border border-[#4B2818]/15 px-3 text-right font-bold outline-none focus:border-[#A51F2B]"
                />
                <span />
              </div>
            ))}
          </div>
        )}
      </section>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={guardarTurno}
          disabled={guardando}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-[#A51F2B] px-5 text-sm font-black text-white transition hover:bg-[#74151F] disabled:cursor-wait disabled:opacity-60"
        >
          {guardando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {guardando
            ? 'Guardando turno'
            : `Guardar ${turnoSeleccionado?.nombre || 'turno'}`}
        </button>
      </div>
    </div>
  );
}
