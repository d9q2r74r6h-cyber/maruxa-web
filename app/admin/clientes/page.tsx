'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Edit3,
  Loader2,
  Save,
  Search,
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

type ProductoPrecio = {
  id: number;
  codigo: string | null;
  nombre: string;
  precio: number | null;
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

const repartidoresBase = [
  'JUAN ALFREDO TAPIA NAVARRETE',
  'LUIS ALBORNOZ',
  'PANADERIA',
];

function normalizar(texto: string | null | undefined) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizarRut(rut: string | null | undefined) {
  return String(rut || '')
    .replace(/[^0-9kK]/g, '')
    .toUpperCase();
}

function repartidorOficial(nombre: string | null | undefined) {
  const valor = normalizar(nombre);

  if (!valor) return '';
  if (valor === 'juan' || valor.includes('tapia')) {
    return 'JUAN ALFREDO TAPIA NAVARRETE';
  }
  if (valor === 'luis albornoz' || valor.includes('albornoz')) {
    return 'LUIS ALBORNOZ';
  }
  if (valor === 'panaderia' || valor === 'panadería') {
    return 'PANADERIA';
  }

  return nombre?.trim() || '';
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
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [clientePrecios, setClientePrecios] = useState<Cliente | null>(null);
  const [productosPrecios, setProductosPrecios] = useState<ProductoPrecio[]>([]);
  const [preciosProducto, setPreciosProducto] = useState<Record<string, string>>(
    {}
  );
  const [preciosOriginales, setPreciosOriginales] = useState<
    Record<string, string>
  >({});
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [cargandoPrecios, setCargandoPrecios] = useState(false);
  const [guardandoPrecios, setGuardandoPrecios] = useState(false);
  const [mensajePrecios, setMensajePrecios] = useState('');
  const [clienteCambiandoEstado, setClienteCambiandoEstado] = useState<string | null>(
    null
  );

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
    return repartidoresBase;
  }, []);

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
        normalizar(repartidorOficial(cliente.repartidor_nombre)) ===
          normalizar(filtroRepartidor);

      const coincideEstado =
        filtroEstado === 'todos' ||
        (filtroEstado === 'activos' && cliente.activo) ||
        (filtroEstado === 'inactivos' && !cliente.activo);

      return coincideBusqueda && coincideRepartidor && coincideEstado;
    });
  }, [busqueda, clientes, filtroEstado, filtroRepartidor]);

  const clienteRutExistente = useMemo(() => {
    const rut = normalizarRut(form.rut);
    if (rut.length < 7) return null;

    return (
      clientes.find(
        (cliente) =>
          cliente.id !== clienteEditando?.id &&
          normalizarRut(cliente.rut) === rut
      ) || null
    );
  }, [clienteEditando?.id, clientes, form.rut]);

  const productosFiltradosPrecios = useMemo(() => {
    const texto = normalizar(busquedaProducto);
    if (!texto) return productosPrecios;
    return productosPrecios.filter((producto) =>
      normalizar(`${producto.codigo || ''} ${producto.nombre}`).includes(texto)
    );
  }, [busquedaProducto, productosPrecios]);

  async function abrirPrecios(cliente: Cliente) {
    if (!perfil) return;
    setClientePrecios(cliente);
    setCargandoPrecios(true);
    setBusquedaProducto('');
    setMensajePrecios('');
    setProductosPrecios([]);
    setPreciosProducto({});
    setPreciosOriginales({});

    const [resultadoProductos, resultadoPrecios] = await Promise.all([
      supabase
        .from('productos')
        .select('id,codigo,nombre,precio')
        .eq('empresa_id', perfil.empresa_id)
        .eq('activo', true)
        .eq('tipo_producto', 'producto')
        .order('nombre'),
      supabase
        .from('cliente_producto_precios')
        .select('producto_id,precio')
        .eq('empresa_id', perfil.empresa_id)
        .eq('cliente_id', cliente.id)
        .eq('activo', true),
    ]);

    if (resultadoProductos.error || resultadoPrecios.error) {
      alert(
        resultadoProductos.error?.message ||
          resultadoPrecios.error?.message ||
          'No se pudieron cargar los precios del cliente.'
      );
      setClientePrecios(null);
      setCargandoPrecios(false);
      return;
    }

    const precios = Object.fromEntries(
      (resultadoPrecios.data || []).map((item) => [
        String(item.producto_id),
        String(item.precio),
      ])
    );
    setProductosPrecios((resultadoProductos.data || []) as ProductoPrecio[]);
    setPreciosProducto(precios);
    setPreciosOriginales(precios);
    setCargandoPrecios(false);
  }

  function cerrarPrecios() {
    if (guardandoPrecios) return;
    setClientePrecios(null);
    setMensajePrecios('');
  }

  async function guardarPreciosCliente(event: React.FormEvent) {
    event.preventDefault();
    if (!perfil || !clientePrecios) return;

    const preciosIngresados = Object.entries(preciosProducto).filter(
      ([, valor]) => valor.trim() !== ''
    );
    const precioInvalido = preciosIngresados.some(([, valor]) => {
      const precio = Number(valor.replace(',', '.'));
      return !Number.isFinite(precio) || precio < 0;
    });
    if (precioInvalido) {
      alert('Revisa los precios ingresados. No pueden ser negativos.');
      return;
    }

    setGuardandoPrecios(true);
    setMensajePrecios('');

    const filas = preciosIngresados.map(([productoId, valor]) => ({
      empresa_id: perfil.empresa_id,
      cliente_id: clientePrecios.id,
      producto_id: Number(productoId),
      precio: numero(valor),
      activo: true,
    }));

    if (filas.length > 0) {
      const { error } = await supabase
        .from('cliente_producto_precios')
        .upsert(filas, { onConflict: 'cliente_id,producto_id' });
      if (error) {
        alert(error.message);
        setGuardandoPrecios(false);
        return;
      }
    }

    const productosEliminados = Object.keys(preciosOriginales)
      .filter((productoId) => !preciosProducto[productoId]?.trim())
      .map(Number);

    if (productosEliminados.length > 0) {
      const { error } = await supabase
        .from('cliente_producto_precios')
        .delete()
        .eq('empresa_id', perfil.empresa_id)
        .eq('cliente_id', clientePrecios.id)
        .in('producto_id', productosEliminados);
      if (error) {
        alert(error.message);
        setGuardandoPrecios(false);
        return;
      }
    }

    const siguientesOriginales = Object.fromEntries(preciosIngresados);
    setPreciosOriginales(siguientesOriginales);
    setMensajePrecios('Precios guardados correctamente.');
    setGuardandoPrecios(false);
  }

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
      repartidor_nombre: repartidorOficial(cliente.repartidor_nombre),
      forma_pago: cliente.forma_pago || '',
      plazo_pago: cliente.plazo_pago || '',
      precio_base: cliente.precio_base ? String(cliente.precio_base) : '',
    });
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    if (!perfil) return;

    if (clienteRutExistente) {
      alert(
        `El RUT ingresado ya pertenece a ${clienteRutExistente.razon_social}.`
      );
      return;
    }

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
      repartidor_nombre: repartidorOficial(form.repartidor_nombre) || null,
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
    const nuevoEstado = !cliente.activo;
    setClienteCambiandoEstado(cliente.id);
    setClientes((actuales) =>
      actuales.map((item) =>
        item.id === cliente.id ? { ...item, activo: nuevoEstado } : item
      )
    );

    const { error } = await supabase
      .from('clientes')
      .update({ activo: nuevoEstado })
      .eq('id', cliente.id)
      .eq('empresa_id', perfil.empresa_id);

    setClienteCambiandoEstado(null);

    if (error) {
      setClientes((actuales) =>
        actuales.map((item) =>
          item.id === cliente.id ? { ...item, activo: cliente.activo } : item
        )
      );
      alert(error.message);
      return;
    }
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
                {campo === 'rut' && clienteRutExistente && (
                  <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-black text-red-700">
                    Este RUT ya existe: {clienteRutExistente.razon_social}
                    {clienteRutExistente.activo ? ' (activo)' : ' (inactivo)'}.
                  </span>
                )}
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
            disabled={guardando || Boolean(clienteRutExistente)}
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
              <option value="todos">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
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
                  className={`grid gap-3 px-5 py-4 md:grid-cols-[140px_1fr_170px_165px] ${
                    cliente.activo ? 'bg-white' : 'bg-red-50/35'
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
                            : 'bg-red-50 text-red-700'
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
                      Repartidor:{' '}
                      {repartidorOficial(cliente.repartidor_nombre) ||
                        'Sin asignar'}
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
                      onClick={() => abrirPrecios(cliente)}
                      className="grid h-9 w-9 place-items-center rounded-md border border-[#A51F2B]/25 text-[#A51F2B] hover:bg-red-50"
                      title="Precios por producto"
                    >
                      <BadgeDollarSign className="h-4 w-4" />
                    </button>
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
                      disabled={clienteCambiandoEstado === cliente.id}
                      className={`relative h-7 w-14 rounded-full transition disabled:cursor-wait disabled:opacity-70 ${
                        cliente.activo
                          ? 'bg-emerald-500'
                          : 'bg-red-500'
                      }`}
                      title={cliente.activo ? 'Desactivar' : 'Activar'}
                      aria-label={cliente.activo ? 'Desactivar cliente' : 'Activar cliente'}
                    >
                      <span
                        className={`absolute top-1 grid h-5 w-5 place-items-center rounded-full bg-white shadow-sm transition-transform ${
                          cliente.activo ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      >
                        {clienteCambiandoEstado === cliente.id && (
                          <Loader2 className="h-3 w-3 animate-spin text-[#A51F2B]" />
                        )}
                      </span>
                      <span className="sr-only">
                        {cliente.activo ? 'Cliente activo' : 'Cliente inactivo'}
                      </span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {clientePrecios && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2A1710]/55 p-3 sm:p-6">
          <form
            onSubmit={guardarPreciosCliente}
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[#4B2818]/15 bg-white shadow-2xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-5 py-4">
              <div>
                <div className="flex items-center gap-2 text-[#A51F2B]">
                  <BadgeDollarSign className="h-5 w-5" />
                  <h2 className="font-black text-[#2A1710]">
                    Precios por producto
                  </h2>
                </div>
                <p className="mt-1 text-xs font-bold text-[#4B2818]/60">
                  {clientePrecios.sigla || clientePrecios.razon_social}
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarPrecios}
                disabled={guardandoPrecios}
                className="grid h-9 w-9 place-items-center rounded-md border border-[#4B2818]/15 bg-white text-[#4B2818] disabled:opacity-50"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-[#4B2818]/10 px-5 py-3">
              <label className="relative block">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#4B2818]/45" />
                <input
                  value={busquedaProducto}
                  onChange={(event) => setBusquedaProducto(event.target.value)}
                  placeholder="Buscar producto o codigo"
                  className="h-9 w-full rounded-md border border-[#4B2818]/15 bg-white pl-9 pr-3 text-sm font-bold outline-none focus:border-[#A51F2B]"
                />
              </label>
              <p className="mt-2 text-xs font-semibold text-[#4B2818]/55">
                El precio general aparece como referencia. Deja vacío el precio
                cliente para eliminar su precio especial.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {cargandoPrecios ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[#A51F2B]" />
                </div>
              ) : productosFiltradosPrecios.length === 0 ? (
                <p className="p-10 text-center text-sm font-semibold text-[#4B2818]/55">
                  No se encontraron productos.
                </p>
              ) : (
                <div className="divide-y divide-[#4B2818]/10">
                  <div className="sticky top-0 z-10 grid grid-cols-[1fr_120px_140px] gap-3 bg-[#2A1710] px-5 py-2 text-[11px] font-black uppercase text-white sm:grid-cols-[1fr_160px_180px]">
                    <span>Producto</span>
                    <span className="text-right">Precio general</span>
                    <span className="text-right">Precio cliente</span>
                  </div>
                  {productosFiltradosPrecios.map((producto) => {
                    const productoId = String(producto.id);
                    return (
                      <div
                        key={producto.id}
                        className="grid grid-cols-[1fr_120px_140px] items-center gap-3 px-5 py-3 sm:grid-cols-[1fr_160px_180px]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#2A1710]">
                            {producto.nombre}
                          </p>
                          <p className="text-[11px] font-bold text-[#4B2818]/50">
                            {producto.codigo || 'Sin codigo'}
                          </p>
                        </div>
                        <p className="text-right text-sm font-bold text-[#4B2818]/65">
                          {producto.precio != null
                            ? `$${Number(producto.precio).toLocaleString('es-CL')}`
                            : '-'}
                        </p>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          aria-label={`Precio cliente ${producto.nombre}`}
                          value={preciosProducto[productoId] || ''}
                          onChange={(event) =>
                            setPreciosProducto((actuales) => ({
                              ...actuales,
                              [productoId]: event.target.value,
                            }))
                          }
                          placeholder="Sin especial"
                          className="h-9 min-w-0 rounded-md border border-[#4B2818]/20 px-3 text-right font-black text-[#2A1710] outline-none focus:border-[#A51F2B]"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#4B2818]/10 bg-[#FFFDF8] px-5 py-4">
              <p className="text-xs font-bold text-emerald-700">
                {mensajePrecios}
              </p>
              <button
                type="submit"
                disabled={cargandoPrecios || guardandoPrecios}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#A51F2B] px-5 text-sm font-black text-white disabled:opacity-60"
              >
                {guardandoPrecios ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Guardar precios
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
