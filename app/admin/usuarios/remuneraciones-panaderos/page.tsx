'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pencil, Printer, Save, Trash2 } from 'lucide-react';
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
const resumenVersion = (configuracion: Config) => {
  const normal = configuracion.normal.casa;
  const festivo = configuracion.festivo.casa;
  return `Casa normal: B ${pesos(normal.batea)} · C ${pesos(normal.cocedor)} · O ${pesos(normal.oficial)} | Festivo: B ${pesos(festivo.batea)} · C ${pesos(festivo.cocedor)} · O ${pesos(festivo.oficial)}`;
};

export default function RemuneracionesPanaderos() {
  const { perfil } = useAdminSession();
  const [cargoIdTecnico, setCargoIdTecnico] = useState('');
  const [versiones, setVersiones] = useState<Version[]>([]);
  const [vigente, setVigente] = useState(hoy);
  const [config, setConfig] = useState<Config>(base);
  const [vigenciaCargadaId, setVigenciaCargadaId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState('');

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

    const versionesCargadas = (historial || []) as Version[];
    const ultimaVersion = versionesCargadas[0];

    setCargoIdTecnico(cargos?.[0]?.id || '');
    setVersiones(versionesCargadas);
    if (ultimaVersion) {
      setVigente(ultimaVersion.vigente_desde);
      setConfig(ultimaVersion.configuracion);
      setVigenciaCargadaId(ultimaVersion.id);
    }
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

  async function eliminar(version: Version) {
    if (!perfil) return;
    if (versiones.length <= 1) {
      alert('Debe mantenerse al menos una vigencia para calcular los pagos de Caja.');
      return;
    }

    const fecha = new Date(`${version.vigente_desde}T12:00:00`).toLocaleDateString('es-CL');
    if (!window.confirm(`¿Eliminar la vigencia desde ${fecha}?\n\nLos días de Caja que dependían de ella usarán la vigencia anterior al volver a calcularse. Esta acción no elimina cierres ya guardados.`)) return;

    setEliminandoId(version.id);
    const { error } = await supabase
      .from('cargo_remuneraciones_especiales')
      .delete()
      .eq('id', version.id)
      .eq('empresa_id', perfil.empresa_id);
    setEliminandoId('');

    if (error) return alert(error.message);
    alert(`Vigencia desde ${fecha} eliminada.`);
    await cargar();
  }

  function editar(version: Version) {
    setVigente(version.vigente_desde);
    setConfig(version.configuracion);
    setVigenciaCargadaId(version.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="remuneraciones-print space-y-5 pb-12">
      <style jsx global>{`
        @media print {
          @page { size: letter landscape; margin: 8mm; }
          body * { visibility: hidden !important; }
          .remuneraciones-print,
          .remuneraciones-print * { visibility: visible !important; }
          .remuneraciones-print {
            position: absolute;
            inset: 0;
            width: 100%;
            padding: 0 !important;
            font-size: 10pt;
          }
          .no-print { display: none !important; }
          .remuneraciones-print header { margin-bottom: 3mm; }
          .remuneraciones-print header h1 { font-size: 18pt; }
          .remuneraciones-print header p { font-size: 8pt; }
          .remuneraciones-print > section { margin-top: 3mm; padding: 3mm; page-break-inside: avoid; }
          .remuneraciones-print > .tabla-remuneracion {
            display: inline-block;
            width: calc(50% - 2mm);
            margin-right: 3mm;
            vertical-align: top;
          }
          .remuneraciones-print > .tabla-remuneracion + .tabla-remuneracion { margin-right: 0; }
          .tabla-remuneracion h2 { font-size: 12pt; }
          .tabla-remuneracion table { min-width: 0; font-size: 8.5pt; }
          .tabla-remuneracion th,
          .tabla-remuneracion td { padding: 1.5mm !important; }
          .tabla-remuneracion input { height: 8mm; padding: 1.5mm !important; font-size: 9pt; }
          .sueldo { color: #b42332 !important; }
          .tabla-festivo h2,
          .fila-externo th { color: #b42332 !important; }
          .demasia-festiva { color: #b42332 !important; }
        }
      `}</style>
      <header>
        <Link href="/admin/usuarios" className="no-print inline-flex items-center gap-2 text-xs font-black uppercase text-[#A51F2B]">
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
          <input type="date" value={vigente} onChange={(e) => { setVigente(e.target.value); setVigenciaCargadaId(''); }} className="h-11 rounded-md border px-3 text-sm font-bold" />
        </label>
      </section>

      {(['normal', 'festivo'] as Tipo[]).map((tipo) => (
        <section key={tipo} className={`tabla-remuneracion rounded-xl border bg-white p-4 ${tipo === 'festivo' ? 'tabla-festivo' : ''}`}>
          <h2 className={`text-lg font-black capitalize ${tipo === 'festivo' ? 'text-[#B42332]' : ''}`}>Día {tipo}</h2>
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
                  <tr key={origen} className={`border-b ${origen === 'externo' ? 'fila-externo' : ''}`}>
                    <th className={`p-3 text-left capitalize ${origen === 'externo' ? 'text-[#B42332]' : ''}`}>{origen}</th>
                    {(['batea', 'cocedor', 'oficial'] as Funcion[]).map((funcion) => (
                      <td key={funcion} className="p-2">
                        <input
                          value={pesos(config[tipo][origen][funcion])}
                          onChange={(e) => cambiar(tipo, origen, funcion, leer(e.target.value))}
                          className="sueldo h-10 w-full rounded border px-3 text-right font-black text-[#B42332]"
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
        <label className="demasia-festiva grid gap-1 text-xs font-black uppercase text-[#B42332]">
          Demasía festiva por QQ
          <input value={pesos(config.demasia_festivo_qq)} onChange={(e) => setConfig({ ...config, demasia_festivo_qq: leer(e.target.value) })} className="h-11 rounded border px-3 text-right text-lg font-black text-[#B42332]" />
        </label>
      </section>

      <div className="no-print flex flex-wrap gap-2">
        <button disabled={guardando} onClick={() => void guardar()} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#A51F2B] px-6 font-black text-white disabled:opacity-60">
          <Save className="h-4 w-4" /> {guardando ? 'Guardando…' : vigenciaCargadaId ? 'Actualizar vigencia' : 'Guardar nueva vigencia'}
        </button>
        <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-md border-2 border-[#2A1710] bg-white px-6 font-black text-[#2A1710]">
          <Printer className="h-4 w-4" /> Imprimir
        </button>
      </div>

      <section className="no-print rounded-xl border bg-white p-4">
        <h2 className="font-black">Historial de vigencias</h2>
        <p className="mt-1 text-xs font-bold text-[#4B2818]/65">Usa el lápiz para cargar y modificar una tabla; al guardar la misma fecha se actualiza esa vigencia. El basurero elimina la versión tras pedir confirmación.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {versiones.map((version) => {
            const cargada = version.id === vigenciaCargadaId;
            const fecha = new Date(`${version.vigente_desde}T12:00:00`).toLocaleDateString('es-CL');
            return <div
              key={version.id}
              className={`flex max-w-full items-start gap-2 rounded-lg border p-1 transition ${cargada ? 'border-[#A51F2B] bg-[#FFF0F2] ring-2 ring-[#A51F2B]/20' : 'bg-[#FFF9EF] hover:border-[#A51F2B]/50'}`}
            >
              <div className="min-w-0 flex-1 px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-black">
                  Desde {fecha}
                  {cargada && <span className="rounded-full bg-[#A51F2B] px-2 py-0.5 text-[10px] uppercase text-white">Cargada</span>}
                </span>
                <span className="mt-1 block text-xs font-bold leading-5 text-[#4B2818]/70">{resumenVersion(version.configuracion)}</span>
              </div>
              <button
                type="button"
                onClick={() => editar(version)}
                title={`Editar vigencia desde ${fecha}`}
                aria-label={`Editar vigencia desde ${fecha}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[#A51F2B] hover:bg-[#FFF0F2]"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={versiones.length <= 1 || Boolean(eliminandoId)}
                onClick={() => void eliminar(version)}
                title={versiones.length <= 1 ? 'Debe mantenerse al menos una vigencia' : `Eliminar vigencia desde ${fecha}`}
                aria-label={`Eliminar vigencia desde ${fecha}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>;
          })}
        </div>
      </section>
    </div>
  );
}
