'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Send,
  Scale,
} from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';
import { supabase } from '@/lib/supabase';

type ComparativoDia = {
  claveRepartidor: string;
  repartidor: string;
  funcionarioId: string | null;
  fecha: string;
  rinde: number;
  repartos: number;
};

type AlertaDemasia = {
  fecha: string;
  turno: number;
  panaderos: number;
  amasado: number;
  demasiaEsperada: number;
  demasiaCaja: number;
  demasiaCajaEnPlanilla: number;
  diferencia: number;
};

// La caja registra 1,5 QQ por cada 1,25 QQ que se muestran en Planilla.
const FACTOR_PLANILLA_POR_QQ_CAJA = 5 / 6;

function mesActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

function numero(valor: unknown) {
  const resultado = Number(valor || 0);
  return Number.isFinite(resultado) ? resultado : 0;
}

function esErrorColumnaPanaderos(error: { message?: string } | null) {
  return Boolean(
    error?.message?.toLowerCase().includes('panaderos') &&
      error.message.toLowerCase().includes('column')
  );
}

function normalizar(valor: string | null | undefined) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function claveRepartidor(nombre: string) {
  const limpio = nombre.trim();
  const partes = normalizar(limpio).split(/\s+/).filter(Boolean);
  if (partes.length >= 4) return partes[partes.length - 2];
  if (partes.length >= 2) return partes[partes.length - 1];
  return partes[0] || 'sin-repartidor';
}

function nombreRepartidorRinde(nombreDetalle: string) {
  let nombre = nombreDetalle.replace(/\s*\[turno:\d+\]\s*$/i, '').trim();
  const separadorTurno = nombre.lastIndexOf(' - ');
  if (separadorTurno > -1) nombre = nombre.slice(0, separadorTurno).trim();
  return nombre;
}

function formatoKilos(valor: number) {
  return `${valor.toLocaleString('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kg`;
}

function formatoFecha(fecha: string) {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${fecha}T12:00:00`));
}

export default function AlertasPage() {
  const { perfil, puedeVer } = useAdminSession();
  const [mes, setMes] = useState(mesActual);
  const [registros, setRegistros] = useState<ComparativoDia[]>([]);
  const [alertasDemasia, setAlertasDemasia] = useState<AlertaDemasia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [errorDemasia, setErrorDemasia] = useState('');
  const [enviando, setEnviando] = useState('');
  const [resultadoEnvio, setResultadoEnvio] = useState<Record<string, string>>({});

  useEffect(() => {
    async function cargarComparativo() {
      if (!perfil?.empresa_id) return;

      setCargando(true);
      setError('');
      setErrorDemasia('');
      setAlertasDemasia([]);
      const anio = Number(mes.slice(0, 4));
      const numeroMes = Number(mes.slice(5, 7));
      const inicio = `${mes}-01`;
      const fin = `${mes}-${String(new Date(anio, numeroMes, 0).getDate()).padStart(2, '0')}`;

      const [planillasRindeResp, planillasRepartoResp, funcionariosResp] = await Promise.all([
        supabase
          .from('planillas')
          .select('id,fecha')
          .eq('empresa_id', perfil.empresa_id)
          .gte('fecha', inicio)
          .lte('fecha', fin),
        supabase
          .from('reparto_planillas')
          .select('id,repartidor_id,repartidor_nombre')
          .eq('empresa_id', perfil.empresa_id)
          .eq('anio', anio)
          .eq('mes', numeroMes)
          .order('repartidor_nombre'),
        supabase
          .from('funcionarios')
          .select('id,nombre_completo')
          .eq('empresa_id', perfil.empresa_id)
          .eq('activo', true),
      ]);

      if (planillasRindeResp.error || planillasRepartoResp.error || funcionariosResp.error) {
        setRegistros([]);
        setError(
          planillasRindeResp.error?.message ||
            planillasRepartoResp.error?.message ||
            funcionariosResp.error?.message ||
            'No fue posible cargar el comparativo.'
        );
        setCargando(false);
        return;
      }

      const idsPlanillasRinde = (planillasRindeResp.data || []).map(
        (planilla) => planilla.id
      );
      const fechaPorPlanillaRinde = new Map(
        (planillasRindeResp.data || []).map((planilla) => [
          String(planilla.id),
          String(planilla.fecha),
        ])
      );
      const idsPlanillasReparto = (planillasRepartoResp.data || []).map(
        (planilla) => planilla.id
      );
      const funcionarioPorClave = new Map(
        (funcionariosResp.data || []).map((funcionario) => [
          claveRepartidor(funcionario.nombre_completo),
          funcionario.id,
        ])
      );
      const repartidorPorPlanilla = new Map(
        (planillasRepartoResp.data || []).map((planilla) => [
          String(planilla.id),
          {
            clave: claveRepartidor(planilla.repartidor_nombre),
            nombre: planilla.repartidor_nombre,
            funcionarioId:
              planilla.repartidor_id ||
              funcionarioPorClave.get(claveRepartidor(planilla.repartidor_nombre)) ||
              null,
          },
        ])
      );
      const nombresPorClave = new Map(
        (planillasRepartoResp.data || []).map((planilla) => [
          claveRepartidor(planilla.repartidor_nombre),
          planilla.repartidor_nombre,
        ])
      );

      const [detallesRindeResp, detallesRepartoResp, cierresCajaResp] = await Promise.all([
        idsPlanillasRinde.length
          ? supabase
              .from('planilla_detalles')
              .select('planilla_id,nombre_producto,kilos_total,producto_id')
              .in('planilla_id', idsPlanillasRinde)
              .is('producto_id', null)
          : Promise.resolve({ data: [], error: null }),
        idsPlanillasReparto.length
          ? supabase
            .from('reparto_planilla_detalles')
            .select('planilla_id,fecha,kilos_vendidos')
            .in('planilla_id', idsPlanillasReparto)
            .gte('fecha', inicio)
            .lte('fecha', fin)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('caja_cierres')
          .select('fecha,turnos_panaderos')
          .eq('empresa_id', perfil.empresa_id)
          .gte('fecha', inicio)
          .lte('fecha', fin),
      ]);

      if (detallesRindeResp.error || detallesRepartoResp.error) {
        setRegistros([]);
        setError(
          detallesRindeResp.error?.message ||
            detallesRepartoResp.error?.message ||
            'No fue posible cargar el detalle de Tapia.'
        );
        setCargando(false);
        return;
      }

      const porRepartidorFecha = new Map<string, ComparativoDia>();
      const obtenerDia = (
        clave: string,
        nombre: string,
        fecha: string,
        funcionarioId: string | null = null
      ) => {
        const llave = `${clave}::${fecha}`;
        const existente = porRepartidorFecha.get(llave);
        if (existente) return existente;
        const nuevo = {
          claveRepartidor: clave,
          repartidor: nombresPorClave.get(clave) || nombre,
          funcionarioId,
          fecha,
          rinde: 0,
          repartos: 0,
        };
        porRepartidorFecha.set(llave, nuevo);
        return nuevo;
      };

      (detallesRindeResp.data || []).forEach((detalle: any) => {
        const fecha = fechaPorPlanillaRinde.get(String(detalle.planilla_id));
        if (!fecha) return;
        const nombre = nombreRepartidorRinde(detalle.nombre_producto || '');
        if (!nombre || normalizar(nombre).startsWith('merma')) return;
        const clave = claveRepartidor(nombre);
        obtenerDia(clave, nombre, fecha).rinde += numero(detalle.kilos_total);
      });

      (detallesRepartoResp.data || []).forEach((detalle: any) => {
        if (!detalle.fecha) return;
        const planilla = repartidorPorPlanilla.get(String(detalle.planilla_id));
        if (!planilla) return;
        const dia = obtenerDia(
          planilla.clave,
          planilla.nombre,
          detalle.fecha,
          planilla.funcionarioId
        );
        dia.repartos += numero(detalle.kilos_vendidos);
      });

      setRegistros(
        Array.from(porRepartidorFecha.values()).sort(
          (a, b) =>
            a.repartidor.localeCompare(b.repartidor, 'es') ||
            a.fecha.localeCompare(b.fecha)
        )
      );

      if (cierresCajaResp.error) {
        setErrorDemasia(
          `No se pudo leer la demasía de Caja: ${cierresCajaResp.error.message}`
        );
      } else if (idsPlanillasRinde.length > 0) {
        let { data: turnosAmasado, error: errorTurnosAmasado } = await supabase
          .from('planilla_turnos')
          .select('planilla_id,turno,amasado,panaderos')
          .in('planilla_id', idsPlanillasRinde)
          .in('turno', [1, 2]);
        const faltaColumnaPanaderos = esErrorColumnaPanaderos(errorTurnosAmasado);
        if (faltaColumnaPanaderos) {
          const respuesta = await supabase
            .from('planilla_turnos')
            .select('planilla_id,turno,amasado')
            .in('planilla_id', idsPlanillasRinde)
            .in('turno', [1, 2]);
          turnosAmasado = (respuesta.data || []).map((turno) => ({ ...turno, panaderos: 0 }));
          errorTurnosAmasado = respuesta.error;
        }
        if (errorTurnosAmasado) {
          setErrorDemasia(`No se pudo leer Panaderos y Amasado: ${errorTurnosAmasado.message}`);
        } else if (faltaColumnaPanaderos) {
          setErrorDemasia(
            'No se puede calcular esta alerta porque falta el campo Panaderos en Planilla.'
          );
        } else {
          const cajaPorFecha = new Map(
            (cierresCajaResp.data || []).map((cierre: any) => [
              String(cierre.fecha),
              Array.isArray(cierre.turnos_panaderos) ? cierre.turnos_panaderos : [],
            ])
          );
          const nuevasAlertas = (turnosAmasado || []).flatMap((turno: any) => {
            const fecha = fechaPorPlanillaRinde.get(String(turno.planilla_id));
            const orden = numero(turno.turno);
            const panaderos = numero(turno.panaderos);
            const amasado = numero(turno.amasado);
            const turnoCaja = fecha ? cajaPorFecha.get(fecha)?.[orden - 1] : null;
            if (!fecha || !turnoCaja || panaderos <= 0 || amasado <= 0) return [];
            const demasiaEsperada = amasado - panaderos * 2;
            const demasiaCaja = numero(turnoCaja.qq);
            const demasiaCajaEnPlanilla =
              demasiaCaja * FACTOR_PLANILLA_POR_QQ_CAJA;
            const diferencia = demasiaCajaEnPlanilla - demasiaEsperada;
            if (Math.abs(diferencia) < 0.01) return [];
            return [
              {
                fecha,
                turno: orden,
                panaderos,
                amasado,
                demasiaEsperada,
                demasiaCaja,
                demasiaCajaEnPlanilla,
                diferencia,
              },
            ];
          });
          setAlertasDemasia(nuevasAlertas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.turno - b.turno));
        }
      }
      setCargando(false);
    }

    void cargarComparativo();
  }, [mes, perfil?.empresa_id]);

  const diasComparables = useMemo(
    () => registros.filter((dia) => dia.rinde > 0 && dia.repartos > 0),
    [registros]
  );

  const resumen = useMemo(() => {
    const porRepartidor = new Map<
      string,
      {
        clave: string;
        nombre: string;
        rinde: number;
        repartos: number;
      }
    >();

    diasComparables.forEach((dia) => {
      const actual = porRepartidor.get(dia.claveRepartidor) || {
        clave: dia.claveRepartidor,
        nombre: dia.repartidor,
        rinde: 0,
        repartos: 0,
      };
      actual.rinde += dia.rinde;
      actual.repartos += dia.repartos;
      porRepartidor.set(dia.claveRepartidor, actual);
    });

    return Array.from(porRepartidor.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es')
    );
  }, [diasComparables]);

  const alertasConDiferencia = useMemo(
    () =>
      diasComparables.filter(
        (dia) => Math.abs(dia.rinde - dia.repartos) > 0.01
      ),
    [diasComparables]
  );

  async function enviarAviso(dia: ComparativoDia) {
    if (dia.rinde <= 0 || dia.repartos <= 0 || Math.abs(dia.rinde - dia.repartos) <= 0.01) return;
    const llave = `${dia.claveRepartidor}-${dia.fecha}`;
    if (!dia.funcionarioId) {
      setResultadoEnvio((actual) => ({ ...actual, [llave]: 'Este reparto no está vinculado a un funcionario.' }));
      return;
    }
    setEnviando(llave);
    setResultadoEnvio((actual) => ({ ...actual, [llave]: '' }));
    const { data: sesion } = await supabase.auth.getSession();
    const diferencia = dia.rinde - dia.repartos;
    const respuesta = await fetch('/api/admin/alertas/notificar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sesion.session?.access_token ? { Authorization: `Bearer ${sesion.session.access_token}` } : {}),
      },
      body: JSON.stringify({
        funcionario_id: dia.funcionarioId,
        mensaje: `Aviso Panadería Maruxa: el ${formatoFecha(dia.fecha)} hay una diferencia de ${formatoKilos(diferencia)} entre Planilla (${formatoKilos(dia.rinde)}) y Repartos (${formatoKilos(dia.repartos)}). Por favor, revisa los datos ingresados.`,
      }),
    });
    const datos = await respuesta.json().catch(() => ({}));
    setResultadoEnvio((actual) => ({
      ...actual,
      [llave]: respuesta.ok ? `Aviso enviado a ${datos.destinatario || dia.repartidor}.` : datos.error || 'No fue posible enviar el aviso.',
    }));
    setEnviando('');
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#A51F2B]">
            Alertas
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#2A1710]">
            Centro de alertas
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-[#4B2818]/65">
            Compara los kilos asignados a cada reparto en la Planilla
            con los kilos ingresados en sus planillas mensuales, y revisa la
            demasía de Caja contra el amasado de cada turno.
          </p>
        </div>
        <label className="grid gap-1 text-xs font-black text-[#4B2818]">
          Mes
          <input
            type="month"
            value={mes}
            onChange={(event) => setMes(event.target.value)}
            className="h-10 rounded-md border border-[#4B2818]/20 bg-white px-3 font-bold"
          />
        </label>
      </header>

      {puedeVer('vehiculos') && (
        <Link
          href="/admin/vehiculos"
          className="flex items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 transition hover:bg-amber-100"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">Alertas de vehículos</p>
              <p className="text-sm font-semibold opacity-70">
                Vencimientos, mantenciones y kilometraje.
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0" />
        </Link>
      )}

      <section className="overflow-hidden rounded-lg border border-red-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-700" />
            <div>
              <h2 className="font-black text-[#2A1710]">
                Demasía de Caja vs Amasado
              </h2>
              <p className="text-xs font-bold text-[#4B2818]/65">
                Demasía en Planilla = Amasado − (Panaderos × 2). 1,5 QQ de
                Caja equivalen a 1,25 QQ de Planilla.
              </p>
            </div>
          </div>
          {alertasDemasia.length > 0 && (
            <span className="rounded-full bg-red-700 px-3 py-1 text-xs font-black text-white">
              {alertasDemasia.length} alerta
              {alertasDemasia.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {cargando ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-[#A51F2B]" />
          </div>
        ) : errorDemasia ? (
          <p className="p-5 text-sm font-bold text-red-700">{errorDemasia}</p>
        ) : alertasDemasia.length === 0 ? (
          <p className="p-6 text-center text-sm font-semibold text-[#4B2818]/60">
            No hay diferencias entre la demasía ingresada en Caja y el amasado
            de Planilla para este mes.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead className="border-b border-[#4B2818]/10 text-xs uppercase text-[#4B2818]/60">
                <tr>
                  <th className="px-5 py-3 text-left">Fecha</th>
                  <th className="px-3 py-3 text-left">Turno</th>
                  <th className="px-3 py-3 text-right">Panaderos</th>
                  <th className="px-3 py-3 text-right">Amasado</th>
                  <th className="px-3 py-3 text-right">Demasía Planilla</th>
                  <th className="px-3 py-3 text-right">Demasía Caja</th>
                  <th className="px-5 py-3 text-right">Diferencia Planilla</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#4B2818]/10">
                {alertasDemasia.map((alerta) => (
                  <tr key={`${alerta.fecha}-${alerta.turno}`}>
                    <td className="px-5 py-3 font-bold capitalize">
                      {formatoFecha(alerta.fecha)}
                    </td>
                    <td className="px-3 py-3 font-black">
                      {alerta.turno === 1 ? '1ra' : '2da'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {alerta.panaderos.toLocaleString('es-CL')}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {alerta.amasado.toLocaleString('es-CL', {
                        maximumFractionDigits: 2,
                      })}{' '}
                      QQ
                    </td>
                    <td className="px-3 py-3 text-right">
                      {alerta.demasiaEsperada.toLocaleString('es-CL', {
                        maximumFractionDigits: 2,
                      })}{' '}
                      QQ
                    </td>
                    <td className="px-3 py-3 text-right font-black">
                      {alerta.demasiaCaja.toLocaleString('es-CL', {
                        maximumFractionDigits: 2,
                      })}{' '}
                      QQ Caja
                      <span className="block text-xs font-semibold text-[#4B2818]/60">
                        = {alerta.demasiaCajaEnPlanilla.toLocaleString('es-CL', {
                          maximumFractionDigits: 2,
                        })}{' '}
                        QQ Planilla
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-black text-red-700">
                      {alerta.diferencia > 0 ? '+' : ''}
                      {alerta.diferencia.toLocaleString('es-CL', {
                        maximumFractionDigits: 2,
                      })}{' '}
                      QQ
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {resumen.map((repartidor) => {
          const diferencia = repartidor.rinde - repartidor.repartos;
          return (
          <div
            key={repartidor.clave}
            className={`rounded-lg border p-4 ${
              Math.abs(diferencia) > 0.01
                ? 'border-amber-300 bg-amber-50'
                : 'border-emerald-300 bg-emerald-50'
            }`}
          >
            <p className="font-black text-[#2A1710]">
              {repartidor.nombre}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs font-black uppercase text-[#4B2818]/50">
                  Planilla
                </p>
                <p className="font-black">{formatoKilos(repartidor.rinde)}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase text-[#4B2818]/50">
                  Repartos
                </p>
                <p className="font-black">
                  {formatoKilos(repartidor.repartos)}
                </p>
              </div>
              <div>
                <p className="text-xs font-black uppercase text-[#4B2818]/50">
                  Diferencia
                </p>
                <p
                  className={`font-black ${
                    Math.abs(diferencia) > 0.01
                      ? 'text-amber-800'
                      : 'text-emerald-700'
                  }`}
                >
                  {diferencia > 0 ? '+' : ''}
                  {formatoKilos(diferencia)}
                </p>
              </div>
            </div>
          </div>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
        <div className="flex items-center gap-2 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-5 py-4">
          <Scale className="h-5 w-5 text-[#A51F2B]" />
          <h2 className="font-black text-[#2A1710]">
            Planilla vs Repartos por día
          </h2>
        </div>

        {cargando ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#A51F2B]" />
          </div>
        ) : error ? (
          <p className="p-6 text-sm font-bold text-red-700">{error}</p>
        ) : alertasConDiferencia.length === 0 ? (
          <p className="p-8 text-center text-sm font-semibold text-[#4B2818]/60">
            {diasComparables.length === 0
              ? 'No hay días con kilos ingresados en ambos lados para comparar este mes.'
              : 'No hay diferencias en los días con kilos ingresados en ambos lados.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-[#4B2818]/10 text-xs uppercase text-[#4B2818]/60">
                <tr>
                  <th className="px-5 py-3 text-left">Reparto</th>
                  <th className="px-5 py-3 text-left">Fecha</th>
                  <th className="px-3 py-3 text-right">Planilla</th>
                  <th className="px-3 py-3 text-right">Repartos</th>
                  <th className="px-5 py-3 text-right">Diferencia</th>
                  <th className="px-5 py-3 text-right">Aviso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#4B2818]/10">
                {alertasConDiferencia.map((dia) => {
                  const diferencia = dia.rinde - dia.repartos;
                  const llave = `${dia.claveRepartidor}-${dia.fecha}`;
                  return (
                    <tr key={`${dia.claveRepartidor}-${dia.fecha}`}>
                      <td className="px-5 py-3 font-black">
                        {dia.repartidor}
                      </td>
                      <td className="px-5 py-3 font-bold capitalize">
                        {formatoFecha(dia.fecha)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatoKilos(dia.rinde)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatoKilos(dia.repartos)}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-black ${
                          Math.abs(diferencia) > 0.01
                            ? 'text-amber-800'
                            : 'text-emerald-700'
                        }`}
                      >
                        {diferencia > 0 ? '+' : ''}
                        {formatoKilos(diferencia)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void enviarAviso(dia)}
                          disabled={enviando === llave}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#A51F2B] px-3 py-2 text-xs font-black text-white disabled:opacity-60"
                        >
                          {enviando === llave ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          Enviar aviso
                        </button>
                        {resultadoEnvio[llave] && <p className={`mt-1 max-w-56 text-xs font-bold ${resultadoEnvio[llave].startsWith('Aviso enviado') ? 'text-emerald-700' : 'text-red-700'}`}>{resultadoEnvio[llave]}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
