'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';
import { supabase } from '@/lib/supabase';

type Origen = 'casa' | 'externo';
type Funcion = 'batea' | 'cocedor' | 'oficial';
type Tipo = 'normal' | 'festivo';
type Config = {
  normal: Record<Origen, Record<Funcion, number>>;
  festivo: Record<Origen, Record<Funcion, number>>;
  demasia_normal_qq: number;
  demasia_festivo_qq: number;
};
type Version = { id: string; vigente_desde: string; configuracion: Config };

const base: Config = {
  normal: {
    casa: { batea: 26800, cocedor: 25700, oficial: 22500 },
    externo: { batea: 31300, cocedor: 29000, oficial: 26000 },
  },
  festivo: {
    casa: { batea: 36600, cocedor: 35000, oficial: 30000 },
    externo: { batea: 43400, cocedor: 41400, oficial: 35400 },
  },
  demasia_normal_qq: 8000,
  demasia_festivo_qq: 12000,
};

const hoy = new Date().toISOString().slice(0, 10);
const pesos = (n: number) => (n ? `$${Math.round(n).toLocaleString('es-CL')}` : '');
const leer = (s: string) => Number(s.replace(/\D/g, '')) || 0;

export default function RemuneracionesPanaderos() {
  const { perfil } = useAdminSession();
  const [cargoIdTecnico, setCargoIdTecnico] = useState('');
  const [versiones, setVersiones] = useState<Version[]>([]);
  const [vigente, setVigente] = useState(hoy);
  const [config, setConfig] = useState<Config>(base);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    if (!perfil) return;

    const [{ data: cargos }, { data: historial }] = await Promise.all([
      supabase
        .from('cargos_empresa')
        .select('id')
        .eq('empresa_id', perfil.empresa_id)
        .eq('modalidad_pago', 'panadero')
        .order('created_at')
        .limit(1),
      supabase
        .from('cargo_remuneraciones_especiales')
        .select('id,vigente_desde,configuracion')
        .eq('empresa_id', perfil.empresa_id)
        .order('vigente_desde', { ascending: false }),
    ]);

    setCargoIdTecnico(cargos?.[0]?.id || '');
    setVersiones((historial || []) as Version[]);
  }

  useEffect(() => {
    void cargar();
  }, [perfil]);

  function cambiar(tipo: Tipo, origen: Origen, funcion: Funcion, valor: number) {
    setConfig({
      ...config,
      [tipo]: {
        ...config[tipo],
        [origen]: { ...config[tipo][origen], [funcion]: valor },
      },
    });
  }

  async function guardar() {
    if (!perfil) return;
    if (!cargoIdTecnico) {
      alert('Primero debe existir al menos un cargo con remuneración especial de panadero.');
      return;
    }

    setGuardando(true);
    const { error } = await supabase.from('cargo_remuneraciones_especiales').upsert(
      {
        empresa_id: perfil.empresa_id,
        cargo_id: cargoIdTecnico,
        vigente_desde: vigente,
        configuracion: config,
      },
      { onConflict: 'empresa_id,vigente_desde' },
    );
    setGuardando(false);

    if (error) return alert(error.message);
    alert('Tabla especial guardada.');
    await cargar();
  }

  return (
    <div className="space-y-5 pb-12">
      <header>
        <Link href="/admin/usuarios" className="inline-flex items-center gap-2 text-xs font-black uppercase text-[#A51F2B]">
          <ArrowLeft className="h-4 w-4" /> Funcionarios
        </Link>
        <h1 className="mt-2 text-3xl font-black text-[#2A1710]">Tabla especial de panaderos</h1>
        <p className="mt-1 text-sm font-bold text-[#4B2818]/65">
          Una tabla única para todos los panaderos. Cada versión se aplica desde su fecha sin modificar cierres históricos.
        </p>
      </header>

      <section className="rounded-xl border bg-white p-4">
        <label className="grid max-w-md gap-1 text-xs font-black uppercase">
          Vigente desde
          <input type="date" value={vigente} onChange={(e) => setVigente(e.target.value)} className="h-11 rounded-md border px-3 text-sm font-bold" />
        </label>
      </section>

      {(['normal', 'festivo'] as Tipo[]).map((tipo) => (
        <section key={tipo} className="rounded-xl border bg-white p-4">
          <h2 className="text-lg font-black capitalize">Día {tipo}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-[#2A1710] text-white">
                <tr>
                  <th className="p-3 text-left">Origen</th>
                  {(['batea', 'cocedor', 'oficial'] as Funcion[]).map((funcion) => (
                    <th key={funcion} className="p-3 text-right capitalize">{funcion}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['casa', 'externo'] as Origen[]).map((origen) => (
                  <tr key={origen} className="border-b">
                    <th className="p-3 text-left capitalize">{origen}</th>
                    {(['batea', 'cocedor', 'oficial'] as Funcion[]).map((funcion) => (
                      <td key={funcion} className="p-2">
                        <input
                          value={pesos(config[tipo][origen][funcion])}
                          onChange={(e) => cambiar(tipo, origen, funcion, leer(e.target.value))}
                          className="h-10 w-full rounded border px-3 text-right font-black"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2">
        <label className="grid gap-1 text-xs font-black uppercase">
          Demasía normal por QQ
          <input value={pesos(config.demasia_normal_qq)} onChange={(e) => setConfig({ ...config, demasia_normal_qq: leer(e.target.value) })} className="h-11 rounded border px-3 text-right text-lg font-black" />
        </label>
        <label className="grid gap-1 text-xs font-black uppercase">
          Demasía festiva por QQ
          <input value={pesos(config.demasia_festivo_qq)} onChange={(e) => setConfig({ ...config, demasia_festivo_qq: leer(e.target.value) })} className="h-11 rounded border px-3 text-right text-lg font-black" />
        </label>
      </section>

      <button disabled={guardando} onClick={() => void guardar()} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#A51F2B] px-6 font-black text-white disabled:opacity-60">
        <Save className="h-4 w-4" /> {guardando ? 'Guardando…' : 'Guardar nueva vigencia'}
      </button>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="font-black">Historial de vigencias</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {versiones.map((version) => (
            <button
              key={version.id}
              onClick={() => { setVigente(version.vigente_desde); setConfig(version.configuracion); }}
              className="rounded-lg border bg-[#FFF9EF] px-4 py-2 text-sm font-black"
            >
              Desde {new Date(`${version.vigente_desde}T12:00:00`).toLocaleDateString('es-CL')}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
