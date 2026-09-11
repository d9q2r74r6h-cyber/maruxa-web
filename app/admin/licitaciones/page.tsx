'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw, Search, Sparkles, Trophy, Zap } from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';
import { supabase } from '@/lib/supabase';

type Oportunidad = {
  codigo: string;
  nombre: string;
  descripcion: string;
  organismo: string;
  region: string;
  fecha_cierre: string | null;
  dias_restantes: number | null;
  monto_estimado: number | null;
  moneda: string;
  puntaje: number;
  coincidencias: string[];
  recomendacion: string;
  url: string;
  ofertas_recibidas?: number;
  convocatoria?: string;
  direccion_entrega?: string;
  plazo_entrega_dias?: number | null;
};

const regiones = ['', 'Los Lagos', 'Los Ríos', 'Araucanía', 'Biobío', 'Metropolitana'];

function dinero(valor: number | null) {
  if (!valor) return 'Monto no informado';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(valor);
}

function fechaCorta(valor: string | null) {
  if (!valor) return 'Sin fecha informada';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(valor));
}

export default function LicitacionesPage() {
  const { perfil } = useAdminSession();
  const [tipo, setTipo] = useState<'licitaciones' | 'compra-agil'>('compra-agil');
  const [palabrasRubro, setPalabrasRubro] = useState<string[]>([]);
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [region, setRegion] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [requiereTicket, setRequiereTicket] = useState(false);
  const [actualizado, setActualizado] = useState('');

  useEffect(() => {
    async function cargarRubro() {
      if (!perfil?.empresa_id) return;
      const { data } = await supabase.from('empresas').select('licitaciones_palabras_clave').eq('id', perfil.empresa_id).maybeSingle();
      setPalabrasRubro(data?.licitaciones_palabras_clave || []);
    }
    void cargarRubro();
  }, [perfil?.empresa_id]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    const params = new URLSearchParams();
    if (busqueda.trim()) params.set('q', busqueda.trim());
    if (region) params.set('region', region);
    if (palabrasRubro.length) params.set('rubros', palabrasRubro.join(','));
    const endpoint = tipo === 'compra-agil' ? '/api/admin/compra-agil' : '/api/admin/licitaciones';
    try {
      const respuesta = await fetch(`${endpoint}?${params}`, { cache: 'no-store' });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setRequiereTicket(Boolean(datos.requiere_ticket));
        throw new Error(datos.error || 'No fue posible buscar oportunidades.');
      }
      setRequiereTicket(false);
      setOportunidades(datos.oportunidades || datos.licitaciones || []);
      setActualizado(datos.actualizado_en || '');
    } catch (e) {
      setOportunidades([]);
      setError(e instanceof Error ? e.message : 'No fue posible buscar oportunidades.');
    } finally {
      setCargando(false);
    }
  }, [busqueda, region, palabrasRubro, tipo]);

  useEffect(() => { void cargar(); }, [cargar]);

  return (
    <main className="space-y-6">
      <header className="rounded-3xl bg-gradient-to-br from-[#4B2818] to-[#7A3528] p-6 text-white shadow-lg">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Agente de oportunidades</p>
        <h1 className="mt-2 text-3xl font-black">Ventas al Estado</h1>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-white/75">
          Analiza oportunidades que coinciden con el rubro configurado para Maruxa y recomienda las más convenientes.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 shadow-sm">
        <button onClick={() => setTipo('compra-agil')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${tipo === 'compra-agil' ? 'bg-red-700 text-white' : 'text-[#4B2818] hover:bg-[#FFF3DF]'}`}>
          <Zap className="h-4 w-4" /> Compra Ágil
        </button>
        <button onClick={() => setTipo('licitaciones')} className={`rounded-xl px-4 py-3 text-sm font-black transition ${tipo === 'licitaciones' ? 'bg-red-700 text-white' : 'text-[#4B2818] hover:bg-[#FFF3DF]'}`}>
          Licitaciones públicas
        </button>
      </div>

      {palabrasRubro.length > 0 && (
        <section className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-4 shadow-sm">
          <span className="text-xs font-black uppercase text-[#4B2818]/50">Rubro activo</span>
          {palabrasRubro.map((palabra) => <span key={palabra} className="rounded-full bg-[#FFF3DF] px-3 py-1 text-xs font-bold text-[#7A3528]">{palabra}</span>)}
        </section>
      )}

      <section className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-[#4B2818]/45" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void cargar()} placeholder="Filtrar dentro del rubro…" className="w-full rounded-xl border border-[#4B2818]/15 py-3 pl-10 pr-3 text-sm font-semibold outline-none focus:border-red-700" />
        </label>
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="rounded-xl border border-[#4B2818]/15 px-3 text-sm font-bold outline-none">
          {regiones.map((r) => <option key={r} value={r}>{r || 'Todas las regiones'}</option>)}
        </select>
        <button onClick={() => void cargar()} disabled={cargando} className="flex items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-3 text-sm font-black text-white hover:bg-red-800 disabled:opacity-60">
          {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Analizar
        </button>
      </section>

      {requiereTicket && <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950"><h2 className="font-black">Falta conectar Mercado Público</h2><p className="mt-1 text-sm font-semibold">Agrega el ticket en Vercel como <code className="rounded bg-white px-1.5 py-0.5">MERCADO_PUBLICO_TICKET</code>.</p></section>}
      {error && !requiereTicket && <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">{error}</p>}

      {!cargando && !error && <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black text-[#4B2818]">{oportunidades.length} oportunidades en {tipo === 'compra-agil' ? 'Compra Ágil' : 'licitaciones'}</p>{actualizado && <p className="text-xs font-semibold text-[#4B2818]/55">Actualizado {fechaCorta(actualizado)}</p>}</div>}

      <section className="grid gap-4">
        {oportunidades.map((item, indice) => (
          <article key={item.codigo} className="rounded-2xl border border-[#4B2818]/10 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {indice < 3 && <Trophy className="h-5 w-5 text-amber-500" />}
                  {tipo === 'compra-agil' && <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">Compra Ágil</span>}
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${item.puntaje >= 70 ? 'bg-emerald-100 text-emerald-800' : item.puntaje >= 50 ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-700'}`}>{item.recomendacion} · {item.puntaje}/100</span>
                  <span className="text-xs font-bold text-[#4B2818]/50">{item.codigo}</span>
                </div>
                <h2 className="mt-3 text-xl font-black text-[#4B2818]">{item.nombre}</h2>
                <p className="mt-1 text-sm font-bold text-[#4B2818]/60">{item.organismo}{item.region ? ` · ${item.region}` : ''}</p>
                {item.descripcion && <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#4B2818]/75">{item.descripcion}</p>}
                <div className="mt-4 flex flex-wrap gap-2">{item.coincidencias.slice(0, 6).map((tag) => <span key={tag} className="rounded-full bg-[#FFF3DF] px-3 py-1 text-xs font-bold text-[#7A3528]">{tag}</span>)}</div>
                {tipo === 'compra-agil' && <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-[#4B2818]/65"><span>{item.ofertas_recibidas ?? 0} cotizaciones recibidas</span>{item.convocatoria && <span>{item.convocatoria}</span>}{item.plazo_entrega_dias != null && <span>Entrega: {item.plazo_entrega_dias} días</span>}</div>}
              </div>
              <aside className="min-w-56 rounded-xl bg-stone-50 p-4">
                <p className="text-xs font-bold uppercase text-[#4B2818]/45">Monto disponible</p>
                <p className="mt-1 text-lg font-black text-[#4B2818]">{dinero(item.monto_estimado)}</p>
                <p className="mt-3 text-xs font-bold uppercase text-[#4B2818]/45">Cierre</p>
                <p className="mt-1 font-black text-[#4B2818]">{fechaCorta(item.fecha_cierre)}</p>
                {item.dias_restantes !== null && <p className="text-xs font-bold text-red-700">{item.dias_restantes > 0 ? `Quedan ${item.dias_restantes} días` : 'Cierre vencido'}</p>}
                <a href={item.url} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-[#4B2818] px-4 py-2.5 text-sm font-black text-white hover:bg-[#6B3A25]">{tipo === 'compra-agil' ? 'Ver y cotizar' : 'Ver licitación'} <ExternalLink className="h-4 w-4" /></a>
              </aside>
            </div>
          </article>
        ))}
        {!cargando && !error && oportunidades.length === 0 && <div className="rounded-2xl bg-white p-10 text-center shadow-sm"><Sparkles className="mx-auto h-8 w-8 text-amber-500" /><p className="mt-3 font-black text-[#4B2818]">No encontramos oportunidades con esos criterios.</p></div>}
      </section>
    </main>
  );
}
