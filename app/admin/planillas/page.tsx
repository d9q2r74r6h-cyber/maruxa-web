'use client';

import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  Calculator,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Wheat,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';
import {
  calcularTurno,
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

type TurnoGuardado = {
  turno: number;
  quintal: number;
  amasado: number;
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
  kilos_producidos: number;
  rinde_por_saco: number;
  pan_sobra: number;
};

const turnoInicial: DatosTurno = {
  amasado: 0,
  masaOcupa: 0,
  masaQueda: 0,
  panRacion: 0,
  panMeson: 0,
  panSobrante: 0,
  merma: 0,
  otroskg: 0,
};

const repartidoresPorDefecto = [
  'JUAN ALFREDO TAPIA NAVARRETE',
  'LUIS ALBORNOZ',
  'PANADERIA',
];

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

function normalizar(texto: string | null | undefined) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function CampoNumero({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold text-[#4B2818]">
      {label}
      <input
        type="number"
        min="0"
        step="0.01"
        value={value || ''}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="h-10 w-full rounded-md border border-[#4B2818]/20 bg-white px-3 text-right text-sm font-bold outline-none transition focus:border-[#A51F2B] focus:ring-2 focus:ring-[#A51F2B]/10"
      />
    </label>
  );
}

function moverConEnter(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'Enter' || event.target instanceof HTMLTextAreaElement) {
    return;
  }

  const actual = event.target as HTMLElement;

  if (!actual.matches('input, select')) return;

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
  const [tablaFuncionariosDisponible, setTablaFuncionariosDisponible] =
    useState(false);
  const [responsable, setResponsable] = useState('');
  const [quintal, setQuintal] = useState(0);
  const [observaciones, setObservaciones] = useState('');
  const [turno, setTurno] = useState<DatosTurno>({ ...turnoInicial });
  const [repartos, setRepartos] = useState<Reparto[]>([
    { id: 'temporal-1', nombre: 'Reparto 1', kilos: 0 },
  ]);
  const [insumos, setInsumos] = useState<InsumoPlanilla[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [resumenDia, setResumenDia] = useState<ResumenDia | null>(null);
  const turnoSeleccionado =
    turnosConfigurados.find((item) => item.id === turnoSeleccionadoId) || null;

  async function cargarResumenDia(fechaSeleccionada = fecha) {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return;

    const { data, error } = await supabase
      .from('planillas')
      .select('turno,kilos_producidos,rinde_por_saco,pan_sobra')
      .eq('empresa_id', empresa.id)
      .eq('fecha', fechaSeleccionada)
      .maybeSingle();

    if (error) {
      setResumenDia(null);
      return;
    }

    setResumenDia((data as ResumenDia | null) || null);
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
            ? repartidoresActivos.map((item) => ({
                id: item.id,
                nombre: item.nombre_completo,
                kilos: 0,
              }))
            : repartidoresPorDefecto.map((nombre) => ({
                id: `base-${normalizar(nombre)}`,
                nombre,
                kilos: 0,
              }))
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

      setCargandoTurnos(false);
      await cargarResumenDia();
    }

    cargarConfiguracion();
  }, []);

  useEffect(() => {
    cargarResumenDia(fecha);
  }, [fecha]);

  useEffect(() => {
    if (cargandoTurnos || !turnoSeleccionado) return;
    cargarTurnoGuardado(fecha, turnoSeleccionado);
  }, [
    cargandoTurnos,
    fecha,
    turnoSeleccionadoId,
    productosRinde,
    repartidoresConfigurados,
    tablaFuncionariosDisponible,
  ]);

  const kilosRepartos = useMemo(
    () => repartos.reduce((total, reparto) => total + reparto.kilos, 0),
    [repartos]
  );

  const datosTurno = useMemo<DatosTurno>(
    () => ({
      ...turno,
      otroskg: 0,
      repartos: repartos.map((reparto) => reparto.kilos),
    }),
    [repartos, turno]
  );

  const calculo = useMemo(() => calcularTurno(datosTurno), [datosTurno]);

  function cambiarCampo(campo: CampoTurno, valor: number) {
    setTurno((actual) => ({ ...actual, [campo]: valor }));
  }

  function repartosBase() {
    if (tablaFuncionariosDisponible && repartidoresConfigurados.length > 0) {
      return repartidoresConfigurados.map((item) => ({
        id: item.id,
        nombre: item.nombre_completo,
        kilos: 0,
      }));
    }

    return repartidoresPorDefecto.map((nombre) => ({
      id: `base-${normalizar(nombre)}`,
      nombre,
      kilos: 0,
    }));
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

  function limpiarTurno() {
    setResponsable('');
    setQuintal(0);
    setObservaciones('');
    setTurno({ ...turnoInicial });
    setRepartos(repartosBase());
    setInsumos(insumosBase());
    setMensaje('');
  }

  async function cargarTurnoGuardado(
    fechaSeleccionada = fecha,
    turnoConfig = turnoSeleccionado
  ) {
    if (!turnoConfig) return;

    const empresa = await obtenerEmpresaActual();
    if (!empresa) return;

    const { data: planilla, error: errorPlanilla } = await supabase
      .from('planillas')
      .select(
        'id,turno,responsable,observaciones,quintal1,quintal2,amasado1,amasado2,masa_ocupada,masa_sobrante,pan_racion,pan_meson,pan_sobra'
      )
      .eq('empresa_id', empresa.id)
      .eq('fecha', fechaSeleccionada)
      .maybeSingle();

    if (errorPlanilla || !planilla) {
      limpiarTurno();
      return;
    }

    const { data: turnoDb, error: errorTurno } = await supabase
      .from('planilla_turnos')
      .select(
        'id,responsable,quintal,amasado,masa_ocupa,masa_queda,pan_racion,pan_meson,pan_sobra,kilos,rinde'
      )
      .eq('planilla_id', planilla.id)
      .eq('turno', turnoConfig.orden)
      .maybeSingle();

    if (errorTurno) {
      limpiarTurno();
      return;
    }

    const [{ data: detallesData }, { data: insumosData }] = await Promise.all([
      supabase
        .from('planilla_detalles')
        .select('nombre_producto,kilos_total,merma')
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
      (item) => !normalizar(item.nombre_producto).startsWith('merma')
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
      limpiarTurno();
      return;
    }

    const mermaGuardada = detalles.reduce(
      (total, item) => total + Number(item.merma || 0),
      0
    );
    const repartosPorNombre = new Map(
      detalleRepartos.map((item) => {
        let nombre = item.nombre_producto.replace(marcadorTurno, '').trim();
        if (nombre.endsWith(sufijoTurno)) {
          nombre = nombre.slice(0, -sufijoTurno.length).trim();
        }
        return [normalizar(nombre), Number(item.kilos_total || 0)];
      })
    );
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
          nombre,
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

    setResponsable(turnoDb?.responsable || planilla.responsable || '');
    setQuintal(Number(turnoDb?.quintal ?? quintalResumen ?? 0));
    setObservaciones('');
    setTurno({
      amasado: Number(turnoDb?.amasado ?? amasadoResumen ?? 0),
      masaOcupa: Number(
        turnoDb?.masa_ocupa ?? (resumenUnSoloTurno ? planilla.masa_ocupada : 0) ?? 0
      ),
      masaQueda: Number(
        turnoDb?.masa_queda ?? (resumenUnSoloTurno ? planilla.masa_sobrante : 0) ?? 0
      ),
      panRacion: Number(
        turnoDb?.pan_racion ?? (resumenUnSoloTurno ? planilla.pan_racion : 0) ?? 0
      ),
      panMeson: Number(
        turnoDb?.pan_meson ?? (resumenUnSoloTurno ? planilla.pan_meson : 0) ?? 0
      ),
      panSobrante: Number(
        turnoDb?.pan_sobra ?? (resumenUnSoloTurno ? planilla.pan_sobra : 0) ?? 0
      ),
      merma: mermaGuardada,
      otroskg: 0,
    });
    setRepartos([...baseRepartos, ...repartosExtras]);
    setInsumos([...baseInsumos, ...insumosExtras]);
    setMensaje(
      turnoDb
        ? `${turnoConfig.nombre} cargado desde la planilla del dia.`
        : `${turnoConfig.nombre} cargado desde resumen historico del dia.`
    );
  }

  function cambiarTurnoSeleccionado(turnoId: string) {
    if (turnoId === turnoSeleccionadoId) return;
    setTurnoSeleccionadoId(turnoId);
    limpiarTurno();
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
    const { data, error } = await supabase
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

    if (error) throw error;

    const turnos = (data || []) as TurnoGuardado[];
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
        pan_meson: turnos.reduce(
          (total, item) => total + Number(item.pan_meson || 0),
          0
        ),
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
        pan_meson: turno.panMeson,
        pan_sobra: turno.panSobrante || 0,
        cacho: 0,
        otroskg: 0,
        centeno: 0,
        meson: 0,
        reparto: kilosRepartos,
        insumos: totalInsumos,
        kilos: calculo.kilos,
        rinde: calculo.rinde,
      };

      const { error: errorTurno } = turnoExistente
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

      if (Number(turno.merma || 0) > 0) {
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
      await cargarResumenDia(fecha);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo guardar el turno.');
    } finally {
      setGuardando(false);
    }
  }

  const colorEstado =
    calculo.estadoRinde === 'ideal'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : calculo.estadoRinde === 'aceptable'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-red-200 bg-red-50 text-red-800';

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
    <div className="space-y-6 pb-12" onKeyDown={moverConEnter}>
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
              Fecha
              <input
                type="date"
                value={fecha}
                onChange={(event) => {
                  setFecha(event.target.value);
                  limpiarTurno();
                }}
                className="h-10 rounded-md border border-[#4B2818]/20 bg-white px-3 font-bold"
              />
            </label>
            <p className="mt-1 text-xs font-black capitalize text-[#A51F2B]">
              {fechaEnPalabras(fecha)}
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

      {mensaje && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
          {mensaje}
        </div>
      )}

      <section className="grid gap-3 rounded-lg border border-[#4B2818]/15 bg-white p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-black uppercase text-[#A51F2B]">
            Rinde general del dia
          </p>
          <p className="mt-1 text-3xl font-black text-[#2A1710]">
            {resumenDia ? Number(resumenDia.rinde_por_saco || 0).toFixed(2) : '--'}
          </p>
        </div>
        <div>
          <p className="text-xs font-black uppercase text-[#4B2818]/55">
            Kilos producidos
          </p>
          <p className="mt-1 text-xl font-black text-[#2A1710]">
            {resumenDia
              ? `${Number(resumenDia.kilos_producidos || 0).toFixed(2)} kg`
              : '--'}
          </p>
        </div>
        <div>
          <p className="text-xs font-black uppercase text-[#4B2818]/55">
            Pan sobrante
          </p>
          <p className="mt-1 text-xl font-black text-[#2A1710]">
            {resumenDia ? `${Number(resumenDia.pan_sobra || 0).toFixed(2)} kg` : '--'}
          </p>
          {resumenDia?.turno && (
            <p className="mt-1 text-xs font-semibold text-[#4B2818]/55">
              Turnos: {resumenDia.turno}
            </p>
          )}
        </div>
      </section>

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
            label="Pan mesón (kg)"
            value={turno.panMeson}
            onChange={(valor) => cambiarCampo('panMeson', valor)}
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
