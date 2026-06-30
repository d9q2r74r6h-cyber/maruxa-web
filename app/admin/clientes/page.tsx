'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Edit3,
  Loader2,
  Save,
  Search,
  ToggleLeft,
  ToggleRight,
  UsersRound,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdminSession } from '@/components/AdminSession';

type Cliente = {
  id: string;
  rut: string;
  razon_social: string;
  giro: string | null;
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  email: string | null;
  telefono: string | null;
  codigo_legacy: string | null;
  sigla: string | null;
  repartidor_nombre: string | null;
  forma_pago: string | null;
  plazo_pago: string | null;
  precio_base: number | null;
  activo: boolean;
};

const inicial = {
  rut: '',
  razon_social: '',
  giro: '',
  direccion: '',
  comuna: '',
  ciudad: '',
  email: '',
  telefono: '',
  codigo_legacy: '',
  sigla: '',
  repartidor_nombre: '',
  forma_pago: '',
  plazo_pago: '',
  precio_base: '',
};

const repartidoresBase = ['Luis Albornoz', 'Juan', 'Panaderia'];

function normalizar(texto: string | null | undefined) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function numero(valor: string) {
  const n = Number(String(valor || '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export default function ClientesPage() {
  const { perfil } = useAdminSession();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [form, setForm] = useState(inicial);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRepartidor, setFiltroRepartidor] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('activos');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    if (!perfil) return;
    setCargando(true);

    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('empresa_id', perfil.empresa_id)
      .order('razon_social');

    if (error) alert(error.message);
    else setClientes((data || []) as Cliente[]);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, [perfil]);

  const repartidores = useMemo(() => {
    const valores = new Set(repartidoresBase);
    clientes.forEach((cliente) => {
      if (cliente.repartidor_nombre?.trim()) {
        valores.add(cliente.repartidor_nombre.trim());
      }
    });
    return Array.from(valores).sort((a, b) => a.localeCompare(b, 'es'));
  }, [clientes]);

  const clientesFiltrados = useMemo(() => {
    const texto = normalizar(busqueda);
    return clientes.filter((cliente) => {
      const coincideBusqueda =
        !texto ||
        normalizar(
          `${cliente.rut} ${cliente.razon_social} ${cliente.sigla || ''} ${
            cliente.codigo_legacy || ''
          }`
        ).includes(texto);

      const coincideRepartidor =
        filtroRepartidor === 'todos' ||
        normalizar(cliente.repartidor_nombre) === normalizar(filtroRepartidor);

      const coincideEstado =
        filtroEstado === 'todos' ||
        (filtroEstado === 'activos' && cliente.activo) ||
        (filtroEstado === 'inactivos' && !cliente.activo);

      return coincideBusqueda && coincideRepartidor && coincideEstado;
    });
  }, [busqueda, clientes, filtroEstado, filtroRepartidor]);

  function cancelarEdicion() {
    setClienteEditando(null);
    setForm(inicial);
  }

  function editar(cliente: Cliente) {
    setClienteEditando(cliente);
    setForm({
      rut: cliente.rut || '',
      razon_social: cliente.razon_social || '',
      giro: cliente.giro || '',
      direccion: cliente.direccion || '',
      comuna: cliente.comuna || '',
      ciudad: cliente.ciudad || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      codigo_legacy: cliente.codigo_legacy || '',
      sigla: cliente.sigla || '',
      repartidor_nombre: cliente.repartidor_nombre || '',
      forma_pago: cliente.forma_pago || '',
      plazo_pago: cliente.plazo_pago || '',
      precio_base: cliente.precio_base ? String(cliente.precio_base) : '',
    });
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    if (!perfil) return;
    setGuardando(true);

    const payload = {
      empresa_id: perfil.empresa_id,
      rut: form.rut.trim(),
      razon_social: form.razon_social.trim(),
      giro: form.giro.trim() || null,
      direccion: form.direccion.trim() || null,
      comuna: form.comuna.trim() || null,
      ciudad: form.ciudad.trim() || null,
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      codigo_legacy: form.codigo_legacy.trim() || null,
      sigla: form.sigla.trim() || null,
      repartidor_nombre: form.repartidor_nombre.trim() || null,
      forma_pago: form.forma_pago.trim() || null,
      plazo_pago: form.plazo_pago.trim() || null,
      precio_base: form.precio_base ? numero(form.precio_base) : null,
    };

    const { error } = clienteEditando
      ? await supabase
          .from('clientes')
          .update(payload)
          .eq('id', clienteEditando.id)
          .eq('empresa_id', perfil.empresa_id)
      : await supabase.from('clientes').insert({
          ...payload,
          activo: true,
        });

    if (error) alert(error.message);
    else {
      cancelarEdicion();
      await cargar();
    }
    setGuardando(false);
  }

  async function cambiarEstado(cliente: Cliente) {
    if (!perfil) return;
    const { error } = await supabase
      .from('clientes')
      .update({ activo: !cliente.activo })
      .eq('id', cliente.id)
      .eq('empresa_id', perfil.empresa_id);

    if (error) alert(error.message);
    else await cargar();
  }

  return (
    <div className="space-y-6 pb-12">
      <header>
        <p className="text-xs font-black uppercase tracking-wide text-[#A51F2B]">
          Comercial
        </p>
        <h1 className="mt-2 text-3xl font-black text-[#2A1710]">Clientes</h1>
        <p className="mt-1 text-sm font-semibold text-[#4B2818]/65">
          Mantencion de clientes, siglas, precios base y asignacion de reparto.
        </p>
      </header>

      <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <form
          onSubmit={guardar}
          className="rounded-lg border border-[#4B2818]/15 bg-white p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-black text-[#2A1710]">
              {clienteEditando ? 'Editar cliente' : 'Nuevo cliente'}
            </h2>
            {clienteEditando && (
              <button
                type="button"
                onClick={cancelarEdicion}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-[#4B2818]/15 px-3 text-xs font-black text-[#4B2818]"
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
              ['sigla', 'Nombre corto'],
              ['codigo_legacy', 'Codigo antiguo'],
              ['giro', 'Giro'],
              ['direccion', 'Direccion'],
              ['comuna', 'Comuna'],
              ['ciudad', 'Ciudad'],
              ['email', 'Correo'],
              ['telefono', 'Telefono'],
              ['precio_base', 'Precio base pan'],
            ].map(([campo, etiqueta]) => (
              <label
                key={campo}
                className="grid gap-1 text-xs font-black text-[#4B2818]"
              >
                {etiqueta}
                <input
                  required={campo === 'rut' || campo === 'razon_social'}
                  type={campo === 'precio_base' ? 'number' : 'text'}
                  value={form[campo as keyof typeof form]}
                  onChange={(event) =>
                    setForm({ ...form, [campo]: event.target.value })
                  }
                  className="h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold outline-none focus:border-[#A51F2B]"
                />
              </label>
            ))}

            <label className="grid gap-1 text-xs font-black text-[#4B2818]">
              Repartidor
              <select
                value={form.repartidor_nombre}
                onChange={(event) =>
                  setForm({ ...form, repartidor_nombre: event.target.value })
                }
                className="h-10 rounded-md border border-[#4B2818]/20 bg-white px-3 font-bold outline-none focus:border-[#A51F2B]"
              >
                <option value="">Sin asignar</option>
                {repartidores.map((repartidor) => (
                  <option key={repartidor} value={repartidor}>
                    {repartidor}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-black text-[#4B2818]">
              Forma de pago
              <input
                value={form.forma_pago}
                onChange={(event) =>
                  setForm({ ...form, forma_pago: event.target.value })
                }
                className="h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold outline-none focus:border-[#A51F2B]"
              />
            </label>

            <label className="grid gap-1 text-xs font-black text-[#4B2818]">
              Plazo de pago
              <input
                value={form.plazo_pago}
                onChange={(event) =>
                  setForm({ ...form, plazo_pago: event.target.value })
                }
                className="h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold outline-none focus:border-[#A51F2B]"
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
            {clienteEditando ? 'Guardar cambios' : 'Guardar cliente'}
          </button>
        </form>

        <div className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
          <div className="grid gap-3 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-5 py-4 lg:grid-cols-[1fr_260px_190px_150px] lg:items-center">
            <div className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-[#A51F2B]" />
              <div>
                <h2 className="font-black text-[#2A1710]">
                  Clientes registrados
                </h2>
                <p className="text-xs font-bold text-[#4B2818]/60">
                  {clientesFiltrados.length} de {clientes.length} clientes
                </p>
              </div>
            </div>

            <label className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#4B2818]/45" />
              <input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar cliente, sigla o RUT"
                className="h-9 w-full rounded-md border border-[#4B2818]/15 bg-white pl-9 pr-3 text-sm font-bold outline-none"
              />
            </label>

            <select
              value={filtroRepartidor}
              onChange={(event) => setFiltroRepartidor(event.target.value)}
              className="h-9 rounded-md border border-[#4B2818]/15 bg-white px-3 text-sm font-bold outline-none"
            >
              <option value="todos">Todos los repartidores</option>
              {repartidores.map((repartidor) => (
                <option key={repartidor} value={repartidor}>
                  {repartidor}
                </option>
              ))}
            </select>

            <select
              value={filtroEstado}
              onChange={(event) => setFiltroEstado(event.target.value)}
              className="h-9 rounded-md border border-[#4B2818]/15 bg-white px-3 text-sm font-bold outline-none"
            >
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
              <option value="todos">Todos</option>
            </select>
          </div>

          {cargando ? (
            <div className="flex justify-center p-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#A51F2B]" />
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <p className="p-10 text-center font-semibold text-[#4B2818]/55">
              No se encontraron clientes.
            </p>
          ) : (
            <div className="divide-y divide-[#4B2818]/10">
              {clientesFiltrados.map((cliente) => (
                <article
                  key={cliente.id}
                  className={`grid gap-3 px-5 py-4 md:grid-cols-[140px_1fr_170px_120px] ${
                    cliente.activo ? 'bg-white' : 'bg-zinc-50 opacity-75'
                  }`}
                >
                  <div>
                    <p className="font-black text-[#A51F2B]">
                      {cliente.sigla || cliente.codigo_legacy || cliente.rut}
                    </p>
                    <p className="text-[11px] font-bold text-[#4B2818]/55">
                      {cliente.rut}
                    </p>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-[#2A1710]">
                        {cliente.razon_social}
                      </p>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                          cliente.activo
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-zinc-200 text-zinc-600'
                        }`}
                      >
                        {cliente.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[#4B2818]/60">
                      {cliente.giro || 'Sin giro'} -{' '}
                      {[cliente.comuna, cliente.ciudad]
                        .filter(Boolean)
                        .join(', ') || 'Sin ubicacion'}
                    </p>
                    <p className="mt-1 text-xs font-bold text-[#A51F2B]">
                      Repartidor: {cliente.repartidor_nombre || 'Sin asignar'}
                    </p>
                  </div>

                  <div className="text-xs font-semibold text-[#4B2818]/60 md:text-right">
                    <p>{cliente.email || cliente.telefono || '-'}</p>
                    <p className="mt-1 font-black text-[#2A1710]">
                      Precio base:{' '}
                      {cliente.precio_base
                        ? `$${Number(cliente.precio_base).toLocaleString('es-CL')}`
                        : '-'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 md:justify-end">
                    <button
                      type="button"
                      onClick={() => editar(cliente)}
                      className="grid h-9 w-9 place-items-center rounded-md border border-[#4B2818]/15 text-[#4B2818] hover:bg-[#FFF3DF]"
                      title="Editar cliente"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => cambiarEstado(cliente)}
                      className={`grid h-9 w-9 place-items-center rounded-md ${
                        cliente.activo
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-zinc-200 text-zinc-600'
                      }`}
                      title={cliente.activo ? 'Desactivar' : 'Activar'}
                    >
                      {cliente.activo ? (
                        <ToggleRight className="h-5 w-5" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
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
