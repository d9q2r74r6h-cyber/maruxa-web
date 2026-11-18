'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Printer, RefreshCw, Users, WalletCards } from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';
import {
  resumirCajaMensual,
  totalGastosCaja,
  totalPanaderosCaja,
  type CierreCajaResumen,
} from '@/lib/resumen-caja-mensual';
import { supabase } from '@/lib/supabase';

type Cierre = CierreCajaResumen & {
  cajera_nombre: string | null;
};

function mesActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

function limitesMes(mes: string) {
  const [anio, numeroMes] = mes.split('-').map(Number);
  const ultimoDia = new Date(anio, numeroMes, 0).getDate();
  return {
    inicio: `${mes}-01`,
    fin: `${mes}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

function numero(valor: unknown) {
  const resultado = Number(valor || 0);
  return Number.isFinite(resultado) ? resultado : 0;
}

function dinero(valor: number) {
  return `$${Math.round(valor || 0).toLocaleString('es-CL')}`;
}

function fechaLocal(fecha: string) {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${fecha}T12:00:00`));
}

function cuadreCaja(cierre: Cierre) {
  return (
    numero(cierre.efectivo) +
    numero(cierre.tarjetas) +
    totalPanaderosCaja(cierre) +
    totalGastosCaja(cierre)
  );
}

export default function InformeCajaPanaderosPage() {
  const { perfil } = useAdminSession();
  const [mes, setMes] = useState(mesActual);
  const [incluirBorradores, setIncluirBorradores] = useState(false);
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  async function cargar() {
    if (!perfil?.empresa_id) return;
    setCargando(true);
    setError('');
    const { inicio, fin } = limitesMes(mes);
    const { data, error: errorCierres } = await supabase
      .from('caja_cierres')
      .select('id,fecha,estado,cajera_nombre,total_ventas,efectivo,tarjetas,compras_gastos,turnos_panaderos,panaderos_primer_turno,panaderos_segundo_turno')
      .eq('empresa_id', perfil.empresa_id)
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .order('fecha', { ascending: false });

    if (errorCierres) {
      setCierres([]);
      setError(errorCierres.message);
    } else {
      setCierres((data || []) as Cierre[]);
    }
    setCargando(false);
  }

  useEffect(() => {
    void cargar();
  }, [perfil?.empresa_id, mes]);

  const resumen = useMemo(
    () => resumirCajaMensual(cierres, incluirBorradores),
    [cierres, incluirBorradores]
  );
  const cajasConDiferencia = useMemo(
    () =>
      resumen.consideradas.filter(
        (cierre) => Math.abs(numero(cierre.total_ventas) - cuadreCaja(cierre as Cierre)) >= 0.5
      ),
    [resumen.consideradas]
  );

  return (
    <div className="caja-mensual-print space-y-6 pb-12">
      <style jsx global>{`
        @media print {
          @page { size: letter landscape; margin: 8mm; }
          body * { visibility: hidden !important; }
          .caja-mensual-print, .caja-mensual-print * { visibility: visible !important; }
          .caja-mensual-print { position: absolute; inset: 0; width: 100%; padding: 0 !important; }
          .no-print { display: none !important; }
          .caja-mensual-print table { font-size: 8pt; }
          .caja-mensual-print th, .caja-mensual-print td { padding: 1.5mm !important; }
        }
      `}</style>

      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <Link
            href="/admin/caja"
            className="no-print inline-flex items-center gap-2 text-xs font-black uppercase text-[#A51F2B]"
          >
            <ArrowLeft className="h-4 w-4" /> Caja diaria
          </Link>
          <p className="mt-3 text-xs font-black uppercase tracking-wide text-[#A51F2B]">
            Informes
          </p>
          <h1 className="mt-1 text-3xl font-black text-[#2A1710]">
            Caja y panaderos por mes
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-bold text-[#4B2818]/65">
            Consolida los importes ya guardados en Caja. Incluye bonos,
            dominicales y séptimos sin recalcular ni cambiar los cierres históricos.
          </p>
        </div>
        <div className="no-print flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs font-black text-[#4B2818]">
            Mes
            <input
              type="month"
              value={mes}
              onChange={(event) => setMes(event.target.value)}
              className="h-11 rounded-md border border-[#4B2818]/20 bg-white px-3 font-bold"
            />
          </label>
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={cargando}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-[#2A1710] bg-white px-4 text-sm font-black text-[#2A1710] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={cargando || resumen.consideradas.length === 0}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-[#2A1710] px-4 text-sm font-black text-white disabled:opacity-50"
          >
            <Printer className="h-4 w-4" /> Imprimir
          </button>
        </div>
      </header>

      <section className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
        <div>
          <p className="font-black text-amber-950">
            {resumen.borradores.length} caja{resumen.borradores.length === 1 ? '' : 's'} en borrador este mes
          </p>
          <p className="text-xs font-bold text-amber-900/75">
            Por seguridad, los totales consideran solo cajas cerradas. Puedes incluir borradores para una vista previa.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-black text-amber-950">
          <input
            type="checkbox"
            checked={incluirBorradores}
            onChange={(event) => setIncluirBorradores(event.target.checked)}
            className="h-4 w-4 accent-[#A51F2B]"
          />
          Incluir borradores
        </label>
      </section>

      {incluirBorradores && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-black text-amber-950">
          Vista previa: los borradores están incluidos y aún pueden cambiar. No representan un pago ni cierre definitivo.
        </p>
      )}

      {error ? (
        <p className="rounded-lg border border-red-300 bg-red-50 p-5 font-bold text-red-800">
          No se pudo cargar el informe: {error}
        </p>
      ) : cargando ? (
        <p className="rounded-xl border bg-white p-8 text-center font-black text-[#4B2818]/60">
          Cargando cierres de Caja...
        </p>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['Cajas cerradas', resumen.cerradas.length.toLocaleString('es-CL')],
              ['Vale de ventas', dinero(resumen.totalVentas)],
              ['Panaderos', dinero(resumen.panaderos)],
              ['Compras y gastos', dinero(resumen.gastos)],
              ['Diferencia mensual', dinero(resumen.diferencia)],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="rounded-xl border bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-[#4B2818]/55">{etiqueta}</p>
                <p className={`mt-2 text-2xl font-black ${etiqueta === 'Diferencia mensual' && Math.abs(resumen.diferencia) >= 0.5 ? 'text-red-700' : 'text-[#2A1710]'}`}>{valor}</p>
              </div>
            ))}
          </section>

          {cajasConDiferencia.length > 0 && (
            <section className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-black">{cajasConDiferencia.length} caja{cajasConDiferencia.length === 1 ? '' : 's'} con diferencia</p>
                <p className="mt-1 text-sm font-bold">Revisa el detalle diario. El informe no modifica las cajas ni sus pagos.</p>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-xl border border-[#4B2818]/15 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#4B2818]/10 bg-[#2A1710] px-5 py-4 text-white">
              <WalletCards className="h-5 w-5" />
              <div>
                <h2 className="font-black">Resumen diario de Caja</h2>
                <p className="text-xs font-bold text-white/65">Efectivo + tarjetas + panaderos + gastos contra vale de ventas.</p>
              </div>
            </div>
            {resumen.consideradas.length === 0 ? (
              <p className="p-8 text-center text-sm font-bold text-[#4B2818]/60">No hay cajas cerradas para este mes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="border-b border-[#4B2818]/10 text-xs uppercase text-[#4B2818]/60">
                    <tr>
                      <th className="px-4 py-3 text-left">Fecha</th>
                      <th className="px-3 py-3 text-left">Cajera</th>
                      <th className="px-3 py-3 text-right">Vale</th>
                      <th className="px-3 py-3 text-right">Efectivo</th>
                      <th className="px-3 py-3 text-right">Tarjetas</th>
                      <th className="px-3 py-3 text-right">Panaderos</th>
                      <th className="px-3 py-3 text-right">Gastos</th>
                      <th className="px-3 py-3 text-right">Diferencia</th>
                      <th className="px-4 py-3 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#4B2818]/10">
                    {resumen.consideradas.map((cierre) => {
                      const diferencia = numero(cierre.total_ventas) - cuadreCaja(cierre as Cierre);
                      return (
                        <tr key={cierre.id} className={Math.abs(diferencia) >= 0.5 ? 'bg-red-50/60' : ''}>
                          <td className="px-4 py-3 font-black">{fechaLocal(cierre.fecha)}</td>
                          <td className="px-3 py-3 font-bold">{(cierre as Cierre).cajera_nombre || 'Sin cajera'}</td>
                          <td className="px-3 py-3 text-right">{dinero(numero(cierre.total_ventas))}</td>
                          <td className="px-3 py-3 text-right">{dinero(numero(cierre.efectivo))}</td>
                          <td className="px-3 py-3 text-right">{dinero(numero(cierre.tarjetas))}</td>
                          <td className="px-3 py-3 text-right">{dinero(totalPanaderosCaja(cierre))}</td>
                          <td className="px-3 py-3 text-right">{dinero(totalGastosCaja(cierre))}</td>
                          <td className={`px-3 py-3 text-right font-black ${Math.abs(diferencia) >= 0.5 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {dinero(diferencia)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${cierre.estado === 'cerrada' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{cierre.estado}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-[#4B2818]/15 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-5 py-4">
              <Users className="h-5 w-5 text-[#A51F2B]" />
              <div>
                <h2 className="font-black text-[#2A1710]">Pagos de panaderos</h2>
                <p className="text-xs font-bold text-[#4B2818]/65">Base y demasía son el importe registrado, separado de bonos, dominicales y séptimos.</p>
              </div>
            </div>
            {resumen.pagosPanaderos.length === 0 ? (
              <p className="p-8 text-center text-sm font-bold text-[#4B2818]/60">No hay pagos de panaderos en las cajas consideradas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-sm">
                  <thead className="border-b border-[#4B2818]/10 text-xs uppercase text-[#4B2818]/60">
                    <tr>
                      <th className="px-4 py-3 text-left">Panadero</th>
                      <th className="px-3 py-3 text-right">Días</th>
                      <th className="px-3 py-3 text-right">Turnos</th>
                      <th className="px-3 py-3 text-right">Base + demasía</th>
                      <th className="px-3 py-3 text-right">Bonos</th>
                      <th className="px-3 py-3 text-right">Dominicales</th>
                      <th className="px-3 py-3 text-right">Séptimos</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#4B2818]/10">
                    {resumen.pagosPanaderos.map((pago) => (
                      <tr key={pago.clave}>
                        <td className="px-4 py-3 font-black">{pago.nombre}</td>
                        <td className="px-3 py-3 text-right">{pago.dias}</td>
                        <td className="px-3 py-3 text-right">{pago.turnos}</td>
                        <td className="px-3 py-3 text-right">{dinero(pago.baseYDemasia)}</td>
                        <td className="px-3 py-3 text-right">{dinero(pago.bonos)}</td>
                        <td className="px-3 py-3 text-right">{dinero(pago.dominicales)}</td>
                        <td className="px-3 py-3 text-right">{dinero(pago.septimos)}</td>
                        <td className="px-4 py-3 text-right text-base font-black text-[#A51F2B]">{dinero(pago.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
