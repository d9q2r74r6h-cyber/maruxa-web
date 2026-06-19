'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';

type EmpresaConfig = {
  id: string;
  nombre_fantasia: string;
  razon_social: string;
  rut: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  tiene_panaderia: boolean;
  tiene_pasteleria: boolean;
  tiene_reparto: boolean;
  tiene_meson: boolean;
  rinde_ideal: number;
  rinde_aceptable: number;
};

type Turno = {
  id: string;
  nombre: string;
  orden: number;
  hora_inicio: string | null;
  hora_fin: string | null;
  activo: boolean;
};

export default function ConfiguracionPage() {
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);

  const [nuevoTurno, setNuevoTurno] = useState({
    nombre: '',
    hora_inicio: '',
    hora_fin: '',
  });

  async function cargarDatos() {
    setLoading(true);

    const empresaActual = await obtenerEmpresaActual();

    if (!empresaActual) {
      alert('No se pudo identificar la empresa.');
      setLoading(false);
      return;
    }

    const { data: empresaData, error: empresaError } = await supabase
      .from('empresas')
      .select('*')
      .eq('id', empresaActual.id)
      .single();

    if (empresaError) {
      alert(empresaError.message);
      setLoading(false);
      return;
    }

    setEmpresa(empresaData as EmpresaConfig);

    const { data: turnosData, error: turnosError } = await supabase
      .from('turnos')
      .select('*')
      .eq('empresa_id', empresaActual.id)
      .order('orden', { ascending: true });

    if (turnosError) {
      alert(turnosError.message);
      setLoading(false);
      return;
    }

    setTurnos((turnosData as Turno[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  async function guardarEmpresa() {
    if (!empresa) return;

    const { error } = await supabase
      .from('empresas')
      .update({
        nombre_fantasia: empresa.nombre_fantasia,
        razon_social: empresa.razon_social,
        rut: empresa.rut,
        telefono: empresa.telefono,
        email: empresa.email,
        direccion: empresa.direccion,
        comuna: empresa.comuna,
        ciudad: empresa.ciudad,
        tiene_panaderia: empresa.tiene_panaderia,
        tiene_pasteleria: empresa.tiene_pasteleria,
        tiene_reparto: empresa.tiene_reparto,
        tiene_meson: empresa.tiene_meson,
        rinde_ideal: empresa.rinde_ideal,
        rinde_aceptable: empresa.rinde_aceptable,
      })
      .eq('id', empresa.id);

    if (error) {
      alert(error.message);
      return;
    }

    alert('Configuración guardada.');
  }

  async function agregarTurno() {
    if (!empresa || !nuevoTurno.nombre) {
      alert('Ingresa el nombre del turno.');
      return;
    }

    const siguienteOrden =
      turnos.length > 0
        ? Math.max(...turnos.map((t) => t.orden)) + 1
        : 1;

    const { error } = await supabase.from('turnos').insert({
      empresa_id: empresa.id,
      nombre: nuevoTurno.nombre,
      orden: siguienteOrden,
      hora_inicio: nuevoTurno.hora_inicio || null,
      hora_fin: nuevoTurno.hora_fin || null,
      activo: true,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNuevoTurno({
      nombre: '',
      hora_inicio: '',
      hora_fin: '',
    });

    cargarDatos();
  }

  async function cambiarEstadoTurno(turno: Turno) {
    const { error } = await supabase
      .from('turnos')
      .update({
        activo: !turno.activo,
      })
      .eq('id', turno.id);

    if (error) {
      alert(error.message);
      return;
    }

    cargarDatos();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-maruxa-crema px-5 py-16">
        <div className="mx-auto max-w-5xl rounded-[34px] bg-white p-8 font-black shadow-premium">
          Cargando configuración...
        </div>
      </main>
    );
  }

  if (!empresa) {
    return null;
  }

  return (
    <main className="min-h-screen bg-maruxa-crema px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <p className="font-black uppercase tracking-[.24em] text-maruxa-rojo">
          Maruxa ERP
        </p>

        <h1 className="mt-3 text-5xl font-black text-maruxa-chocolate">
          Configuración
        </h1>

        <section className="mt-10 rounded-[34px] bg-white p-6 shadow-premium">
          <h2 className="text-2xl font-black text-maruxa-chocolate">
            Datos de empresa
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input
              value={empresa.nombre_fantasia || ''}
              onChange={(e) =>
                setEmpresa({ ...empresa, nombre_fantasia: e.target.value })
              }
              placeholder="Nombre fantasía"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <input
              value={empresa.razon_social || ''}
              onChange={(e) =>
                setEmpresa({ ...empresa, razon_social: e.target.value })
              }
              placeholder="Razón social"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <input
              value={empresa.rut || ''}
              onChange={(e) =>
                setEmpresa({ ...empresa, rut: e.target.value })
              }
              placeholder="RUT"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <input
              value={empresa.telefono || ''}
              onChange={(e) =>
                setEmpresa({ ...empresa, telefono: e.target.value })
              }
              placeholder="Teléfono"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <input
              value={empresa.email || ''}
              onChange={(e) =>
                setEmpresa({ ...empresa, email: e.target.value })
              }
              placeholder="Email"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <input
              value={empresa.direccion || ''}
              onChange={(e) =>
                setEmpresa({ ...empresa, direccion: e.target.value })
              }
              placeholder="Dirección"
              className="rounded-2xl border px-5 py-4 font-bold"
            />
          </div>
        </section>

        <section className="mt-8 rounded-[34px] bg-white p-6 shadow-premium">
          <h2 className="text-2xl font-black text-maruxa-chocolate">
            Operación
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ['tiene_panaderia', 'Tiene panadería'],
              ['tiene_pasteleria', 'Tiene pastelería'],
              ['tiene_reparto', 'Tiene reparto'],
              ['tiene_meson', 'Tiene venta en mesón'],
            ].map(([campo, label]) => (
              <label
                key={campo}
                className="flex items-center gap-3 rounded-2xl bg-maruxa-crema p-4 font-black"
              >
                <input
                  type="checkbox"
                  checked={Boolean(empresa[campo as keyof EmpresaConfig])}
                  onChange={(e) =>
                    setEmpresa({
                      ...empresa,
                      [campo]: e.target.checked,
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[34px] bg-white p-6 shadow-premium">
          <h2 className="text-2xl font-black text-maruxa-chocolate">
            Parámetros de rinde
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input
              type="number"
              value={empresa.rinde_ideal}
              onChange={(e) =>
                setEmpresa({
                  ...empresa,
                  rinde_ideal: Number(e.target.value),
                })
              }
              placeholder="Rinde ideal"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <input
              type="number"
              value={empresa.rinde_aceptable}
              onChange={(e) =>
                setEmpresa({
                  ...empresa,
                  rinde_aceptable: Number(e.target.value),
                })
              }
              placeholder="Rinde aceptable"
              className="rounded-2xl border px-5 py-4 font-bold"
            />
          </div>
        </section>

        <section className="mt-8 rounded-[34px] bg-white p-6 shadow-premium">
          <h2 className="text-2xl font-black text-maruxa-chocolate">
            Turnos
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <input
              value={nuevoTurno.nombre}
              onChange={(e) =>
                setNuevoTurno({ ...nuevoTurno, nombre: e.target.value })
              }
              placeholder="Nombre del turno"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <input
              type="time"
              value={nuevoTurno.hora_inicio}
              onChange={(e) =>
                setNuevoTurno({ ...nuevoTurno, hora_inicio: e.target.value })
              }
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <input
              type="time"
              value={nuevoTurno.hora_fin}
              onChange={(e) =>
                setNuevoTurno({ ...nuevoTurno, hora_fin: e.target.value })
              }
              className="rounded-2xl border px-5 py-4 font-bold"
            />
          </div>

          <button
            type="button"
            onClick={agregarTurno}
            className="mt-5 rounded-full bg-maruxa-rojo px-8 py-4 font-black text-white"
          >
            Agregar turno
          </button>

          <div className="mt-6 grid gap-3">
            {turnos.map((turno) => (
              <div
                key={turno.id}
                className="flex items-center justify-between rounded-2xl bg-maruxa-crema p-4"
              >
                <div>
                  <p className="font-black text-maruxa-chocolate">
                    {turno.orden}. {turno.nombre}
                  </p>
                  <p className="text-sm font-bold text-maruxa-cafe/70">
                    {turno.hora_inicio || '--:--'} → {turno.hora_fin || '--:--'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => cambiarEstadoTurno(turno)}
                  className="rounded-full bg-white px-5 py-3 text-sm font-black"
                >
                  {turno.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={guardarEmpresa}
          className="mt-8 w-full rounded-full bg-maruxa-rojo px-8 py-5 text-xl font-black text-white shadow-premium"
        >
          Guardar configuración
        </button>
      </div>
    </main>
  );
}