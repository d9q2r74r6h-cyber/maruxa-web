'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdminSession } from '@/components/AdminSession';

type RegistroRinde = {
  id: string;
  fecha: string;
  turno: number;
  responsable: string | null;
  kilos: number;
  rinde: number;
};

function mesActual() {
  return new Date().toISOString().slice(0, 7);
}

export default function InformeRindePage() {
  const { perfil } = useAdminSession();
  const [mes, setMes] = useState(mesActual);
  const [registros, setRegistros] = useState<RegistroRinde[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      if (!perfil) return;
      setCargando(true);
      const inicio = `${mes}-01`;
      const fin = new Date(
        Number(mes.slice(0, 4)),
        Number(mes.slice(5, 7)),
        0
      )
        .toISOString()
        .slice(0, 10);

      const { data, error } = await supabase
        .from('planilla_turnos')
        .select(`
          id,
          turno,
          responsable,
          kilos,
          rinde,
          planillas!inner (
            fecha,
            empresa_id
          )
        `)
        .eq('planillas.empresa_id', perfil.empresa_id)
        .gte('planillas.fecha', inicio)
        .lte('planillas.fecha', fin)
        .order('created_at', { ascending: true });

      if (error) {
        alert(error.message);
        setRegistros([]);
      } else {
        setRegistros(
          (data || []).map((item: any) => ({
            id: item.id,
            fecha: Array.isArray(item.planillas)
              ? item.planillas[0]?.fecha
              : item.planillas?.fecha,
            turno: Number(item.turno),
            responsable: item.responsable,
            kilos: Number(item.kilos || 0),
            rinde: Number(item.rinde || 0),
          }))
        );
      }
      setCargando(false);
    }

    cargar();
  }, [mes, perfil]);

  const resumen = useMemo(() => {
    const kilos = registros.reduce((total, item) => total + item.kilos, 0);
    const factor = registros.reduce(
      (total, item) =>
        total + (item.rinde > 0 ? item.kilos / item.rinde : 0),
      0
    );
    return {
      jornadas: registros.length,
      kilos,
      rinde: factor > 0 ? kilos / factor : 0,
      ideal: registros.filter((item) => item.rinde >= 64).length,
      bajo: registros.filter((item) => item.rinde < 63).length,
    };
  }, [registros]);

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#A51F2B]">
            Producción
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#2A1710]">
            Informe mensual de rinde
          </h1>
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Jornadas', resumen.jornadas.toString()],
          ['Kilos', resumen.kilos.toFixed(2)],
          ['Rinde promedio', resumen.rinde.toFixed(2)],
          ['Rinde ideal', resumen.ideal.toString()],
          ['Rinde bajo', resumen.bajo.toString()],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta} className="rounded-lg border border-[#4B2818]/15 bg-white p-4">
            <p className="text-xs font-black uppercase text-[#4B2818]/55">
              {etiqueta}
            </p>
            <p className="mt-1 text-2xl font-black text-[#2A1710]">{valor}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
        <div className="flex items-center gap-2 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-5 py-4">
          <BarChart3 className="h-5 w-5 text-[#A51F2B]" />
          <h2 className="font-black text-[#2A1710]">Detalle diario</h2>
        </div>
        {cargando ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#A51F2B]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead className="border-b border-[#4B2818]/10 text-xs uppercase text-[#4B2818]/60">
                <tr>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-3 py-3 text-left">Turno</th>
                  <th className="px-3 py-3 text-left">Responsable</th>
                  <th className="px-3 py-3 text-right">Kilos</th>
                  <th className="px-4 py-3 text-right">Rinde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#4B2818]/10">
                {registros.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-bold">{item.fecha}</td>
                    <td className="px-3 py-3">Turno {item.turno}</td>
                    <td className="px-3 py-3">{item.responsable || '-'}</td>
                    <td className="px-3 py-3 text-right">{item.kilos.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-black">
                      {item.rinde.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

