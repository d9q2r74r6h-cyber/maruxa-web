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
  whatsapp: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  iva_porcentaje: number;
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

type ImpuestoAdicional = {
  id: string;
  nombre: string;
  descripcion: string | null;
  porcentaje: number;
  activo: boolean;
};

type CuentaBancaria = {
  id: string;
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  titular: string;
  rut_titular: string | null;
  email_notificacion: string | null;
  alias: string | null;
  es_principal: boolean;
  activo: boolean;
};

export default function ConfiguracionPage() {
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [impuestos, setImpuestos] = useState<ImpuestoAdicional[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<CuentaBancaria[]>([]);
  const [cuentaEditando, setCuentaEditando] = useState<CuentaBancaria | null>(null);
  const [loading, setLoading] = useState(true);

  const [nuevoTurno, setNuevoTurno] = useState({
    nombre: '',
    hora_inicio: '',
    hora_fin: '',
  });
  const [nuevoImpuesto, setNuevoImpuesto] = useState({
    nombre: '',
    descripcion: '',
    porcentaje: '',
  });
  const [nuevaCuenta, setNuevaCuenta] = useState({
    banco: '',
    tipo_cuenta: 'Cuenta corriente',
    numero_cuenta: '',
    titular: '',
    rut_titular: '',
    email_notificacion: '',
    alias: '',
    es_principal: false,
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
      .maybeSingle();

    if (empresaError) {
      alert(empresaError.message);
      setLoading(false);
      return;
    }

    if (!empresaData) {
      alert(
        'No tienes acceso a la configuración de esta empresa. Ejecuta la migración de corrección de acceso ERP.'
      );
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

    const { data: impuestosData, error: impuestosError } = await supabase
      .from('impuestos_adicionales')
      .select('id, nombre, descripcion, porcentaje, activo')
      .eq('empresa_id', empresaActual.id)
      .order('nombre', { ascending: true });

    if (!impuestosError) {
      setImpuestos((impuestosData as ImpuestoAdicional[]) || []);
    }

    const { data: cuentasData, error: cuentasError } = await supabase
      .from('cuentas_bancarias')
      .select(
        'id,banco,tipo_cuenta,numero_cuenta,titular,rut_titular,email_notificacion,alias,es_principal,activo'
      )
      .eq('empresa_id', empresaActual.id)
      .order('es_principal', { ascending: false })
      .order('banco', { ascending: true });

    if (!cuentasError) {
      setCuentasBancarias((cuentasData as CuentaBancaria[]) || []);
    }

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
        whatsapp: empresa.whatsapp,
        instagram_url: empresa.instagram_url,
        facebook_url: empresa.facebook_url,
        iva_porcentaje: Number(empresa.iva_porcentaje || 19),
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

  async function agregarImpuesto() {
    if (!empresa || !nuevoImpuesto.nombre.trim()) {
      alert('Ingresa el nombre del impuesto.');
      return;
    }

    const porcentaje = Number(String(nuevoImpuesto.porcentaje).replace(',', '.'));

    if (porcentaje <= 0) {
      alert('Ingresa un porcentaje mayor a cero.');
      return;
    }

    const { error } = await supabase.from('impuestos_adicionales').insert({
      empresa_id: empresa.id,
      nombre: nuevoImpuesto.nombre.trim(),
      descripcion: nuevoImpuesto.descripcion.trim() || null,
      porcentaje,
      activo: true,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNuevoImpuesto({ nombre: '', descripcion: '', porcentaje: '' });
    cargarDatos();
  }

  async function cambiarEstadoImpuesto(impuesto: ImpuestoAdicional) {
    const { error } = await supabase
      .from('impuestos_adicionales')
      .update({ activo: !impuesto.activo })
      .eq('id', impuesto.id);

    if (error) {
      alert(error.message);
      return;
    }

    cargarDatos();
  }

  async function agregarCuentaBancaria() {
    if (!empresa || !nuevaCuenta.banco.trim()) {
      alert('Ingresa el banco.');
      return;
    }

    if (!nuevaCuenta.numero_cuenta.trim()) {
      alert('Ingresa el número de cuenta.');
      return;
    }

    if (!nuevaCuenta.titular.trim()) {
      alert('Ingresa el titular de la cuenta.');
      return;
    }

    const { error } = await supabase.from('cuentas_bancarias').insert({
      empresa_id: empresa.id,
      banco: nuevaCuenta.banco.trim(),
      tipo_cuenta: nuevaCuenta.tipo_cuenta,
      numero_cuenta: nuevaCuenta.numero_cuenta.trim(),
      titular: nuevaCuenta.titular.trim(),
      rut_titular: nuevaCuenta.rut_titular.trim() || null,
      email_notificacion: nuevaCuenta.email_notificacion.trim() || null,
      alias: nuevaCuenta.alias.trim() || null,
      es_principal: nuevaCuenta.es_principal,
      activo: true,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNuevaCuenta({
      banco: '',
      tipo_cuenta: 'Cuenta corriente',
      numero_cuenta: '',
      titular: '',
      rut_titular: '',
      email_notificacion: '',
      alias: '',
      es_principal: false,
    });
    cargarDatos();
  }

  async function cambiarEstadoCuenta(cuenta: CuentaBancaria) {
    const { error } = await supabase
      .from('cuentas_bancarias')
      .update({ activo: !cuenta.activo })
      .eq('id', cuenta.id);

    if (error) {
      alert(error.message);
      return;
    }

    cargarDatos();
  }

  async function guardarCuentaEditada() {
    if (!empresa || !cuentaEditando) return;

    if (!cuentaEditando.banco.trim() || !cuentaEditando.numero_cuenta.trim()) {
      alert('Completa el banco y el numero de cuenta.');
      return;
    }

    if (!cuentaEditando.titular.trim()) {
      alert('Ingresa el titular de la cuenta.');
      return;
    }

    if (cuentaEditando.es_principal) {
      const { error: errorReset } = await supabase
        .from('cuentas_bancarias')
        .update({ es_principal: false })
        .eq('empresa_id', empresa.id)
        .neq('id', cuentaEditando.id);

      if (errorReset) {
        alert(errorReset.message);
        return;
      }
    }

    const { error } = await supabase
      .from('cuentas_bancarias')
      .update({
        banco: cuentaEditando.banco.trim(),
        tipo_cuenta: cuentaEditando.tipo_cuenta,
        numero_cuenta: cuentaEditando.numero_cuenta.trim(),
        titular: cuentaEditando.titular.trim(),
        rut_titular: cuentaEditando.rut_titular?.trim() || null,
        email_notificacion: cuentaEditando.email_notificacion?.trim() || null,
        alias: cuentaEditando.alias?.trim() || null,
        es_principal: cuentaEditando.es_principal,
        activo: cuentaEditando.activo,
      })
      .eq('id', cuentaEditando.id);

    if (error) {
      alert(error.message);
      return;
    }

    setCuentaEditando(null);
    cargarDatos();
  }

  async function marcarCuentaPrincipal(cuenta: CuentaBancaria) {
    if (!empresa) return;

    const { error: errorReset } = await supabase
      .from('cuentas_bancarias')
      .update({ es_principal: false })
      .eq('empresa_id', empresa.id);

    if (errorReset) {
      alert(errorReset.message);
      return;
    }

    const { error } = await supabase
      .from('cuentas_bancarias')
      .update({ es_principal: true, activo: true })
      .eq('id', cuenta.id);

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
              value={empresa.whatsapp || ''}
              onChange={(e) =>
                setEmpresa({ ...empresa, whatsapp: e.target.value })
              }
              placeholder="WhatsApp ej: 56986232447"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <input
              value={empresa.instagram_url || ''}
              onChange={(e) =>
                setEmpresa({ ...empresa, instagram_url: e.target.value })
              }
              placeholder="URL Instagram"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <input
              value={empresa.facebook_url || ''}
              onChange={(e) =>
                setEmpresa({ ...empresa, facebook_url: e.target.value })
              }
              placeholder="URL Facebook"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <label className="space-y-2">
              <span className="block text-xs font-black uppercase tracking-wide text-maruxa-cafe/60">
                IVA general %
              </span>
              <input
                type="number"
                value={empresa.iva_porcentaje ?? 19}
                onChange={(e) =>
                  setEmpresa({
                    ...empresa,
                    iva_porcentaje: Number(e.target.value || 19),
                  })
                }
                className="h-14 w-full rounded-2xl border px-5 font-bold"
              />
              <span className="block text-xs font-semibold text-maruxa-cafe/60">
                Se aplica por defecto a precios, documentos y productos.
              </span>
            </label>

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
            Impuestos adicionales
          </h2>

          <p className="mt-2 text-sm font-bold text-maruxa-cafe/70">
            Crea aqui los impuestos especiales que luego podras seleccionar en productos.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1.4fr_180px_auto]">
            <input
              value={nuevoImpuesto.nombre}
              onChange={(e) =>
                setNuevoImpuesto({
                  ...nuevoImpuesto,
                  nombre: e.target.value,
                })
              }
              placeholder="Nombre del impuesto"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <input
              value={nuevoImpuesto.descripcion}
              onChange={(e) =>
                setNuevoImpuesto({
                  ...nuevoImpuesto,
                  descripcion: e.target.value,
                })
              }
              placeholder="Descripcion"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <input
              type="number"
              value={nuevoImpuesto.porcentaje}
              onChange={(e) =>
                setNuevoImpuesto({
                  ...nuevoImpuesto,
                  porcentaje: e.target.value,
                })
              }
              placeholder="%"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <button
              type="button"
              onClick={agregarImpuesto}
              className="rounded-full border-2 border-red-700 bg-red-700 px-8 py-4 font-black text-white shadow-lg transition hover:bg-red-800"
            >
              Agregar
            </button>
          </div>

          <div className="mt-6 grid gap-3">
            {impuestos.length === 0 ? (
              <p className="rounded-2xl bg-maruxa-crema p-4 text-sm font-bold text-maruxa-cafe/70">
                No hay impuestos adicionales configurados.
              </p>
            ) : (
              impuestos.map((impuesto) => (
                <div
                  key={impuesto.id}
                  className="flex items-center justify-between rounded-2xl bg-maruxa-crema p-4"
                >
                  <div>
                    <p className="font-black text-maruxa-chocolate">
                      {impuesto.nombre}
                    </p>
                    <p className="text-sm font-bold text-maruxa-cafe/70">
                      {Number(impuesto.porcentaje).toLocaleString('es-CL')}%
                    </p>
                    {impuesto.descripcion && (
                      <p className="mt-1 text-sm font-bold text-maruxa-cafe/60">
                        {impuesto.descripcion}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => cambiarEstadoImpuesto(impuesto)}
                    className="rounded-full bg-white px-5 py-3 text-sm font-black"
                  >
                    {impuesto.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-8 rounded-[34px] bg-white p-6 shadow-premium">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-maruxa-chocolate">
                Cuentas bancarias
              </h2>
              <p className="mt-2 text-sm font-bold text-maruxa-cafe/70">
                Registra una o varias cuentas para pagos, documentos y datos comerciales.
              </p>
            </div>

            {cuentasBancarias.some((cuenta) => cuenta.es_principal) && (
              <span className="w-fit rounded-full bg-emerald-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-700">
                Principal configurada
              </span>
            )}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <input
              value={nuevaCuenta.banco}
              onChange={(e) =>
                setNuevaCuenta({ ...nuevaCuenta, banco: e.target.value })
              }
              placeholder="Banco"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <select
              value={nuevaCuenta.tipo_cuenta}
              onChange={(e) =>
                setNuevaCuenta({
                  ...nuevaCuenta,
                  tipo_cuenta: e.target.value,
                })
              }
              className="rounded-2xl border px-5 py-4 font-bold"
            >
              <option>Cuenta corriente</option>
              <option>Cuenta vista</option>
              <option>Cuenta de ahorro</option>
              <option>Cuenta RUT</option>
            </select>

            <input
              value={nuevaCuenta.numero_cuenta}
              onChange={(e) =>
                setNuevaCuenta({
                  ...nuevaCuenta,
                  numero_cuenta: e.target.value,
                })
              }
              placeholder="Numero de cuenta"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <input
              value={nuevaCuenta.titular}
              onChange={(e) =>
                setNuevaCuenta({ ...nuevaCuenta, titular: e.target.value })
              }
              placeholder="Titular"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <input
              value={nuevaCuenta.rut_titular}
              onChange={(e) =>
                setNuevaCuenta({
                  ...nuevaCuenta,
                  rut_titular: e.target.value,
                })
              }
              placeholder="RUT titular"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <input
              value={nuevaCuenta.email_notificacion}
              onChange={(e) =>
                setNuevaCuenta({
                  ...nuevaCuenta,
                  email_notificacion: e.target.value,
                })
              }
              placeholder="Email notificacion"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <input
              value={nuevaCuenta.alias}
              onChange={(e) =>
                setNuevaCuenta({ ...nuevaCuenta, alias: e.target.value })
              }
              placeholder="Alias visible"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <label className="flex items-center gap-3 rounded-2xl bg-maruxa-crema px-5 py-4 font-black text-maruxa-chocolate">
              <input
                type="checkbox"
                checked={nuevaCuenta.es_principal}
                onChange={(e) =>
                  setNuevaCuenta({
                    ...nuevaCuenta,
                    es_principal: e.target.checked,
                  })
                }
              />
              Cuenta principal
            </label>
          </div>

          <button
            type="button"
            onClick={agregarCuentaBancaria}
            className="mt-5 rounded-full bg-maruxa-rojo px-8 py-4 font-black text-white"
          >
            Agregar cuenta
          </button>

          <div className="mt-6 grid gap-3">
            {cuentasBancarias.length === 0 ? (
              <p className="rounded-2xl bg-maruxa-crema p-4 text-sm font-bold text-maruxa-cafe/70">
                No hay cuentas bancarias configuradas.
              </p>
            ) : (
              cuentasBancarias.map((cuenta) => (
                <div
                  key={cuenta.id}
                  className={`rounded-2xl p-4 ${
                    cuenta.activo ? 'bg-maruxa-crema' : 'bg-zinc-100 opacity-70'
                  }`}
                >
                  {cuentaEditando?.id === cuenta.id ? (
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <input
                        value={cuentaEditando.banco}
                        onChange={(e) =>
                          setCuentaEditando({ ...cuentaEditando, banco: e.target.value })
                        }
                        placeholder="Banco"
                        className="min-w-0 rounded-xl border bg-white px-4 py-3 font-bold"
                      />
                      <select
                        value={cuentaEditando.tipo_cuenta}
                        onChange={(e) =>
                          setCuentaEditando({ ...cuentaEditando, tipo_cuenta: e.target.value })
                        }
                        className="min-w-0 rounded-xl border bg-white px-4 py-3 font-bold"
                      >
                        <option>Cuenta corriente</option>
                        <option>Cuenta vista</option>
                        <option>Cuenta de ahorro</option>
                        <option>Cuenta RUT</option>
                      </select>
                      <input
                        value={cuentaEditando.numero_cuenta}
                        onChange={(e) =>
                          setCuentaEditando({ ...cuentaEditando, numero_cuenta: e.target.value })
                        }
                        placeholder="Numero de cuenta"
                        className="min-w-0 rounded-xl border bg-white px-4 py-3 font-bold"
                      />
                      <input
                        value={cuentaEditando.titular}
                        onChange={(e) =>
                          setCuentaEditando({ ...cuentaEditando, titular: e.target.value })
                        }
                        placeholder="Titular"
                        className="min-w-0 rounded-xl border bg-white px-4 py-3 font-bold"
                      />
                      <input
                        value={cuentaEditando.rut_titular || ''}
                        onChange={(e) =>
                          setCuentaEditando({ ...cuentaEditando, rut_titular: e.target.value })
                        }
                        placeholder="RUT titular"
                        className="min-w-0 rounded-xl border bg-white px-4 py-3 font-bold"
                      />
                      <input
                        value={cuentaEditando.email_notificacion || ''}
                        onChange={(e) =>
                          setCuentaEditando({ ...cuentaEditando, email_notificacion: e.target.value })
                        }
                        placeholder="Email notificacion"
                        className="min-w-0 rounded-xl border bg-white px-4 py-3 font-bold"
                      />
                      <input
                        value={cuentaEditando.alias || ''}
                        onChange={(e) =>
                          setCuentaEditando({ ...cuentaEditando, alias: e.target.value })
                        }
                        placeholder="Alias visible"
                        className="min-w-0 rounded-xl border bg-white px-4 py-3 font-bold"
                      />
                      <label className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 font-black">
                        <input
                          type="checkbox"
                          checked={cuentaEditando.es_principal}
                          onChange={(e) =>
                            setCuentaEditando({ ...cuentaEditando, es_principal: e.target.checked })
                          }
                        />
                        Cuenta principal
                      </label>
                      <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-4">
                        <button
                          type="button"
                          onClick={guardarCuentaEditada}
                          className="rounded-full bg-maruxa-rojo px-5 py-3 text-sm font-black text-white"
                        >
                          Guardar cambios
                        </button>
                        <button
                          type="button"
                          onClick={() => setCuentaEditando(null)}
                          className="rounded-full bg-white px-5 py-3 text-sm font-black"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-maruxa-chocolate">
                          {cuenta.alias || cuenta.banco}
                        </p>
                        {cuenta.es_principal && (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                            Principal
                          </span>
                        )}
                        {!cuenta.activo && (
                          <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-black text-zinc-600">
                            Inactiva
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-bold text-maruxa-cafe/70">
                        {cuenta.banco} - {cuenta.tipo_cuenta} - {cuenta.numero_cuenta}
                      </p>
                      <p className="mt-1 text-sm font-bold text-maruxa-cafe/70">
                        {cuenta.titular}
                        {cuenta.rut_titular ? ` - ${cuenta.rut_titular}` : ''}
                        {cuenta.email_notificacion
                          ? ` - ${cuenta.email_notificacion}`
                          : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setCuentaEditando({ ...cuenta })}
                        className="rounded-full bg-white px-5 py-3 text-sm font-black"
                      >
                        Editar cuenta
                      </button>
                      {!cuenta.es_principal && (
                        <button
                          type="button"
                          onClick={() => marcarCuentaPrincipal(cuenta)}
                          className="rounded-full bg-white px-5 py-3 text-sm font-black"
                        >
                          Marcar principal
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => cambiarEstadoCuenta(cuenta)}
                        className="rounded-full bg-white px-5 py-3 text-sm font-black"
                      >
                        {cuenta.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                  )}
                </div>
              ))
            )}
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
