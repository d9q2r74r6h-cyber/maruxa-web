'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Scale,
} from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';
import { supabase } from '@/lib/supabase';

type ComparativoDia = {
  fecha: string;
  tapiaRinde: number;
  repartos: number;
  devueltos: number;
};

function mesActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

function numero(valor: unknown) {
  const resultado = Number(valor || 0);
  return Number.isFinite(resultado) ? resultado : 0;
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
    month: 'short',
  }).format(new Date(`${fecha}T12:00:00`));
}

export default function AlertasPage() {
  const { perfil, puedeVer } = useAdminSession();
  const [mes, setMes] = useState(mesActual);
  const [registros, setRegistros] = useState<ComparativoDia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function cargarComparativo() {
      if (!perfil?.empresa_id) return;

      setCargando(true);
      setError('');
      const anio = Number(mes.slice(0, 4));
      const numeroMes = Number(mes.slice(5, 7));
      const inicio = `${mes}-01`;
      const fin = `${mes}-${String(new Date(anio, numeroMes, 0).getDate()).padStart(2, '0')}`;

      const [planillasRindeResp, planillasRepartoResp] = await Promise.all([
        supabase
          .from('planillas')
          .select('id,fecha')
          .eq('empresa_id', perfil.empresa_id)
          .gte('fecha', inicio)
          .lte('fecha', fin),
        supabase
          .from('reparto_planillas')
          .select('id,repartidor_nombre')
          .eq('empresa_id', perfil.empresa_id)
          .eq('anio', anio)
          .eq('mes', numeroMes)
          .ilike('repartidor_nombre', '%tapia%'),
      ]);

      if (planillasRindeResp.error || planillasRepartoResp.error) {
        setRegistros([]);
        setError(
          planillasRindeResp.error?.message ||
            planillasRepartoResp.error?.message ||
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

      const [detallesRindeResp, detallesRepartoResp] = await Promise.all([
        idsPlanillasRinde.length
          ? supabase
              .from('planilla_detalles')
              .select('planilla_id,nombre_producto,kilos_total,producto_id')
              .in('planilla_id', idsPlanillasRinde)
              .is('producto_id', null)
              .ilike('nombre_producto', '%tapia%')
          : Promise.resolve({ data: [], error: null }),
        idsPlanillasReparto.length
          ? supabase
            .from('reparto_planilla_detalles')
            .select('fecha,kilos_vendidos,kilos_devueltos')
            .in('planilla_id', idsPlanillasReparto)
            .gte('fecha', inicio)
            .lte('fecha', fin)
          : Promise.resolve({ data: [], error: null }),
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

      const porFecha = new Map<string, ComparativoDia>();
      const obtenerDia = (fecha: string) => {
        const existente = porFecha.get(fecha);
        if (existente) return existente;
        const nuevo = {
          fecha,
          tapiaRinde: 0,
          repartos: 0,
          devueltos: 0,
        };
        porFecha.set(fecha, nuevo);
        return nuevo;
      };

      (detallesRindeResp.data || []).forEach((detalle: any) => {
        const fecha = fechaPorPlanillaRinde.get(String(detalle.planilla_id));
        if (!fecha) return;
        obtenerDia(fecha).tapiaRinde += numero(detalle.kilos_total);
      });

      (detallesRepartoResp.data || []).forEach((detalle: any) => {
        if (!detalle.fecha) return;
        obtenerDia(detalle.fecha).repartos += numero(detalle.kilos_vendidos);
        obtenerDia(detalle.fecha).devueltos += numero(detalle.kilos_devueltos);
      });

      setRegistros(
        Array.from(porFecha.values()).sort((a, b) =>
          a.fecha.localeCompare(b.fecha)
        )
      );
      setCargando(false);
    }

    void cargarComparativo();
  }, [mes, perfil?.empresa_id]);

  const resumen = useMemo(() => {
    const tapiaRinde = registros.reduce(
      (total, dia) => total + dia.tapiaRinde,
      0
    );
    const repartos = registros.reduce((total, dia) => total + dia.repartos, 0);
    const devueltos = registros.reduce(
      (total, dia) => total + dia.devueltos,
      0
    );
    return {
      tapiaRinde,
      repartos,
      devueltos,
      diferencia: tapiaRinde - repartos,
    };
  }, [registros]);

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
            Compara los kilos asignados a Tapia en la planilla de Rinde con
            los kilos ingresados en la planilla mensual de Tapia.
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Tapia · Rinde', resumen.tapiaRinde, 'bg-white'],
          ['Tapia · Repartos', resumen.repartos, 'bg-white'],
          ['Devoluciones', resumen.devueltos, 'bg-white'],
          [
            'Diferencia',
            resumen.diferencia,
            Math.abs(resumen.diferencia) > 0.01
              ? 'border-amber-300 bg-amber-50'
              : 'border-emerald-300 bg-emerald-50',
          ],
        ].map(([etiqueta, valor, clase]) => (
          <div
            key={String(etiqueta)}
            className={`rounded-lg border border-[#4B2818]/15 p-4 ${clase}`}
          >
            <p className="text-xs font-black uppercase text-[#4B2818]/55">
              {etiqueta}
            </p>
            <p className="mt-1 text-2xl font-black text-[#2A1710]">
              {formatoKilos(Number(valor))}
            </p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
        <div className="flex items-center gap-2 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-5 py-4">
          <Scale className="h-5 w-5 text-[#A51F2B]" />
          <h2 className="font-black text-[#2A1710]">
            Tapia Rinde vs Tapia Repartos por día
          </h2>
        </div>

        {cargando ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#A51F2B]" />
          </div>
        ) : error ? (
          <p className="p-6 text-sm font-bold text-red-700">{error}</p>
        ) : registros.length === 0 ? (
          <p className="p-8 text-center text-sm font-semibold text-[#4B2818]/60">
            No hay kilos de Tapia registrados en Rinde ni en Repartos para
            este mes.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="border-b border-[#4B2818]/10 text-xs uppercase text-[#4B2818]/60">
                <tr>
                  <th className="px-5 py-3 text-left">Fecha</th>
                  <th className="px-3 py-3 text-right">Tapia · Rinde</th>
                  <th className="px-3 py-3 text-right">Tapia · Repartos</th>
                  <th className="px-3 py-3 text-right">Devueltos</th>
                  <th className="px-5 py-3 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#4B2818]/10">
                {registros.map((dia) => {
                  const diferencia = dia.tapiaRinde - dia.repartos;
                  return (
                    <tr key={dia.fecha}>
                      <td className="px-5 py-3 font-bold capitalize">
                        {formatoFecha(dia.fecha)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatoKilos(dia.tapiaRinde)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatoKilos(dia.repartos)}
                      </td>
                      <td className="px-3 py-3 text-right text-[#4B2818]/65">
                        {formatoKilos(dia.devueltos)}
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
