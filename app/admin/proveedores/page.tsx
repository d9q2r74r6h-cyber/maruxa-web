'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Loader2,
  Pencil,
  Power,
  Save,
  Search,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdminSession } from '@/components/AdminSession';

type Proveedor = {
  id: string;
  rut: string | null;
  razon_social: string;
  nombre_fantasia: string | null;
  giro: string | null;
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  email: string | null;
  telefono: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  condiciones_pago: string | null;
  dias_credito: number;
  observaciones: string | null;
  activo: boolean;
};

const inicial = {
  rut: '',
  razon_social: '',
  nombre_fantasia: '',
  giro: '',
  direccion: '',
  comuna: '',
  ciudad: '',
  email: '',
  telefono: '',
  contacto_nombre: '',
  contacto_email: '',
  contacto_telefono: '',
  condiciones_pago: '',
  dias_credito: '0',
  observaciones: '',
};

function limpiarTexto(valor: string) {
  return valor.trim() || null;
}

export default function ProveedoresPage() {
  const { perfil } = useAdminSession();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [form, setForm] = useState(inicial);
  const [editando, setEditando] = useState<Proveedor | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const proveedoresFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return proveedores.filter((proveedor) => {
      if (!mostrarInactivos && !proveedor.activo) return false;
      if (!texto) return true;

      return [
        proveedor.rut,
        proveedor.razon_social,
        proveedor.nombre_fantasia,
        proveedor.giro,
        proveedor.contacto_nombre,
        proveedor.email,
        proveedor.telefono,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(texto);
    });
  }, [busqueda, mostrarInactivos, proveedores]);

  async function cargar() {
    if (!perfil) return;
    setCargando(true);

    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .eq('empresa_id', perfil.empresa_id)
      .order('razon_social', { ascending: true });

    if (error) {
      alert(error.message);
    } else {
      setProveedores((data || []) as Proveedor[]);
    }

    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, [perfil]);

  function limpiarFormulario() {
    setForm(inicial);
    setEditando(null);
  }

  function editar(proveedor: Proveedor) {
    setEditando(proveedor);
    setForm({
      rut: proveedor.rut || '',
      razon_social: proveedor.razon_social || '',
      nombre_fantasia: proveedor.nombre_fantasia || '',
      giro: proveedor.giro || '',
      direccion: proveedor.direccion || '',
      comuna: proveedor.comuna || '',
      ciudad: proveedor.ciudad || '',
      email: proveedor.email || '',
      telefono: proveedor.telefono || '',
      contacto_nombre: proveedor.contacto_nombre || '',
      contacto_email: proveedor.contacto_email || '',
      contacto_telefono: proveedor.contacto_telefono || '',
      condiciones_pago: proveedor.condiciones_pago || '',
      dias_credito: String(proveedor.dias_credito || 0),
      observaciones: proveedor.observaciones || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function datosProveedor() {
    return {
      rut: limpiarTexto(form.rut),
      razon_social: form.razon_social.trim(),
      nombre_fantasia: limpiarTexto(form.nombre_fantasia),
      giro: limpiarTexto(form.giro),
      direccion: limpiarTexto(form.direccion),
      comuna: limpiarTexto(form.comuna),
      ciudad: limpiarTexto(form.ciudad),
      email: limpiarTexto(form.email),
      telefono: limpiarTexto(form.telefono),
      contacto_nombre: limpiarTexto(form.contacto_nombre),
      contacto_email: limpiarTexto(form.contacto_email),
      contacto_telefono: limpiarTexto(form.contacto_telefono),
      condiciones_pago: limpiarTexto(form.condiciones_pago),
      dias_credito: Number(form.dias_credito || 0),
      observaciones: limpiarTexto(form.observaciones),
    };
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    if (!perfil) return;

    if (!form.razon_social.trim()) {
      alert('Ingresa la razon social o nombre del proveedor.');
      return;
    }

    setGuardando(true);

    const datos = datosProveedor();
    const respuesta = editando
      ? await supabase
          .from('proveedores')
          .update(datos)
          .eq('id', editando.id)
      : await supabase.from('proveedores').insert({
          ...datos,
          empresa_id: perfil.empresa_id,
          activo: true,
        });

    if (respuesta.error) {
      alert(respuesta.error.message);
    } else {
      limpiarFormulario();
      await cargar();
    }

    setGuardando(false);
  }

  async function cambiarEstado(proveedor: Proveedor) {
    const { error } = await supabase
      .from('proveedores')
      .update({ activo: !proveedor.activo })
      .eq('id', proveedor.id);

    if (error) {
      alert(error.message);
      return;
    }

    await cargar();
  }

  return (
    <div className="space-y-6 pb-12">
      <header>
        <p className="text-xs font-black uppercase tracking-wide text-[#A51F2B]">
          Inventario
        </p>
        <h1 className="mt-2 text-3xl font-black text-[#2A1710]">
          Proveedores
        </h1>
        <p className="mt-1 text-sm font-semibold text-[#4B2818]/65">
          Base de proveedores para compras, costos, pagos y trazabilidad.
        </p>
      </header>

      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form
          onSubmit={guardar}
          className="rounded-lg border border-[#4B2818]/15 bg-white p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-black text-[#2A1710]">
              {editando ? 'Editar proveedor' : 'Nuevo proveedor'}
            </h2>
            {editando && (
              <button
                type="button"
                onClick={limpiarFormulario}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-[#FFF3DF] px-3 text-xs font-black text-[#4B2818]"
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {[
              ['rut', 'RUT'],
              ['razon_social', 'Razon social'],
              ['nombre_fantasia', 'Nombre fantasia'],
              ['giro', 'Giro'],
              ['direccion', 'Direccion'],
              ['comuna', 'Comuna'],
              ['ciudad', 'Ciudad'],
              ['email', 'Correo empresa'],
              ['telefono', 'Telefono empresa'],
              ['contacto_nombre', 'Contacto'],
              ['contacto_email', 'Correo contacto'],
              ['contacto_telefono', 'Telefono contacto'],
              ['condiciones_pago', 'Condiciones de pago'],
              ['dias_credito', 'Dias de credito'],
            ].map(([campo, etiqueta]) => (
              <label
                key={campo}
                className="grid gap-1 text-xs font-black text-[#4B2818]"
              >
                {etiqueta}
                <input
                  required={campo === 'razon_social'}
                  type={campo === 'dias_credito' ? 'number' : 'text'}
                  value={form[campo as keyof typeof form]}
                  onChange={(event) =>
                    setForm({ ...form, [campo]: event.target.value })
                  }
                  className="h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold outline-none focus:border-[#A51F2B]"
                />
              </label>
            ))}

            <label className="grid gap-1 text-xs font-black text-[#4B2818] sm:col-span-2 xl:col-span-1">
              Observaciones
              <textarea
                value={form.observaciones}
                onChange={(event) =>
                  setForm({ ...form, observaciones: event.target.value })
                }
                className="min-h-24 rounded-md border border-[#4B2818]/20 px-3 py-2 font-bold outline-none focus:border-[#A51F2B]"
              />
            </label>
          </div>

          <button
            disabled={guardando}
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#A51F2B] font-black text-white disabled:opacity-60"
          >
            {guardando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {editando ? 'Guardar cambios' : 'Guardar proveedor'}
          </button>
        </form>

        <div className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
          <div className="flex flex-col justify-between gap-3 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-5 py-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#A51F2B]" />
              <h2 className="font-black text-[#2A1710]">
                Proveedores registrados
              </h2>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#4B2818]/45" />
                <input
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Buscar proveedor"
                  className="h-9 w-full rounded-md border border-[#4B2818]/15 bg-white pl-9 pr-3 text-sm font-bold outline-none sm:w-72"
                />
              </label>

              <label className="inline-flex h-9 items-center gap-2 rounded-md bg-white px-3 text-xs font-black text-[#4B2818]">
                <input
                  type="checkbox"
                  checked={mostrarInactivos}
                  onChange={(event) => setMostrarInactivos(event.target.checked)}
                />
                Ver inactivos
              </label>
            </div>
          </div>

          {cargando ? (
            <div className="flex justify-center p-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#A51F2B]" />
            </div>
          ) : proveedoresFiltrados.length === 0 ? (
            <p className="p-10 text-center font-semibold text-[#4B2818]/55">
              No se encontraron proveedores.
            </p>
          ) : (
            <div className="divide-y divide-[#4B2818]/10">
              {proveedoresFiltrados.map((proveedor) => (
                <article
                  key={proveedor.id}
                  className="grid gap-3 px-5 py-4 lg:grid-cols-[170px_1fr_190px_110px]"
                >
                  <div>
                    <p className="font-black text-[#A51F2B]">
                      {proveedor.rut || 'Sin RUT'}
                    </p>
                    <p
                      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${
                        proveedor.activo
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {proveedor.activo ? 'Activo' : 'Inactivo'}
                    </p>
                  </div>

                  <div>
                    <p className="font-black text-[#2A1710]">
                      {proveedor.razon_social}
                    </p>
                    <p className="text-xs font-semibold text-[#4B2818]/60">
                      {proveedor.nombre_fantasia || proveedor.giro || 'Sin nombre fantasia'}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#4B2818]/60">
                      {[proveedor.comuna, proveedor.ciudad]
                        .filter(Boolean)
                        .join(', ') || 'Sin ubicacion'}
                    </p>
                  </div>

                  <div className="text-xs font-semibold text-[#4B2818]/65">
                    <p className="font-black text-[#2A1710]">
                      {proveedor.contacto_nombre || 'Sin contacto'}
                    </p>
                    <p>{proveedor.email || proveedor.contacto_email || '-'}</p>
                    <p>{proveedor.telefono || proveedor.contacto_telefono || '-'}</p>
                  </div>

                  <div className="flex items-start gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => editar(proveedor)}
                      className="grid h-9 w-9 place-items-center rounded-md bg-[#FFF3DF] text-[#4B2818] transition hover:bg-[#A51F2B] hover:text-white"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => cambiarEstado(proveedor)}
                      className="grid h-9 w-9 place-items-center rounded-md bg-[#FFF3DF] text-[#4B2818] transition hover:bg-[#A51F2B] hover:text-white"
                      title={proveedor.activo ? 'Desactivar' : 'Activar'}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
