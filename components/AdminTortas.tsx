'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Torta = {
  id: number;
  cliente: string;
  telefono: string;
  sabor: string | null;
  tamano: string | null;
  dedicatoria: string | null;
  fecha_retiro: string | null;
  hora_retiro: string | null;
  observaciones: string | null;
  estado: string;
  created_at: string;
};

export default function AdminTortas() {
  const [pedidos, setPedidos] = useState<Torta[]>([]);
  const [cargando, setCargando] = useState(true);

  async function cargarPedidos() {
    setCargando(true);

    const { data, error } = await supabase
      .from('tortas')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPedidos(data as Torta[]);
    }

    setCargando(false);
  }

  async function cambiarEstado(id: number, estado: string) {
    const { error } = await supabase
      .from('tortas')
      .update({ estado })
      .eq('id', id);

    if (error) {
      alert('No se pudo cambiar el estado.');
      return;
    }

    cargarPedidos();
  }

  useEffect(() => {
    cargarPedidos();
  }, []);

  return (
    <main className="min-h-screen bg-maruxa-crema px-6 py-10 text-maruxa-chocolate">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="font-black uppercase tracking-[.22em] text-maruxa-rojo">
              Panel Maruxa
            </p>
            <h1 className="mt-2 text-5xl font-black tracking-[-.04em]">
              Pedidos de tortas
            </h1>
            <p className="mt-3 text-maruxa-cafe/75">
              Pedidos guardados desde el formulario público.
            </p>
          </div>

          <button onClick={cargarPedidos} className="btn-rojo">
            Actualizar
          </button>
        </div>

        {cargando ? (
          <p className="font-bold">Cargando pedidos...</p>
        ) : pedidos.length === 0 ? (
          <div className="card-premium rounded-[30px] p-8">
            <p className="text-xl font-black">Todavía no hay pedidos.</p>
          </div>
        ) : (
          <div className="grid gap-5">
            {pedidos.map((p) => (
              <article key={p.id} className="card-premium rounded-[30px] p-6">
                <div className="flex flex-col justify-between gap-4 lg:flex-row">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-maruxa-rojo px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
                        #{p.id}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-widest text-maruxa-vino">
                        {p.estado}
                      </span>
                    </div>

                    <h2 className="text-3xl font-black">{p.cliente}</h2>
                    <p className="mt-1 font-bold text-maruxa-cafe">
                      {p.telefono}
                    </p>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <Dato label="Sabor" value={p.sabor} />
                      <Dato label="Tamaño" value={p.tamano} />
                      <Dato label="Dedicatoria" value={p.dedicatoria} />
                      <Dato label="Fecha retiro" value={p.fecha_retiro} />
                      <Dato label="Hora retiro" value={p.hora_retiro} />
                      <Dato label="Observaciones" value={p.observaciones} />
                    </div>
                  </div>

                  <div className="flex min-w-[220px] flex-col gap-2">
                    {['pendiente', 'confirmado', 'en preparación', 'listo', 'entregado'].map(
                      (estado) => (
                        <button
                          key={estado}
                          onClick={() => cambiarEstado(p.id, estado)}
                          className={`rounded-full px-4 py-3 text-sm font-black ${
                            p.estado === estado
                              ? 'bg-maruxa-rojo text-white'
                              : 'bg-white text-maruxa-chocolate'
                          }`}
                        >
                          {estado}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Dato({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl bg-white/70 p-4">
      <p className="text-xs font-black uppercase tracking-widest text-maruxa-rojo">
        {label}
      </p>
      <p className="mt-1 font-bold">{value || '-'}</p>
    </div>
  );
}