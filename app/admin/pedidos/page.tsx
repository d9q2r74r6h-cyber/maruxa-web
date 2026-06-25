'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';


type Pedido = {
  id: number;
  cliente: string;
  telefono: string;
  total: number;
  fecha_retiro: string;
  hora_retiro: string;
  observaciones: string | null;
  estado: string;
  productos: {
    nombre: string;
    cantidad: number;
    precio: number;
    imagen?: string | null;
    tamano?: string;
  }[];
  created_at?: string;
};

export default function AdminPedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  const [filtroEstado, setFiltroEstado] = useState('todos');



  async function cambiarEstado(id: number, estado: string) {
    const empresa = await obtenerEmpresaActual();
  
    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      return;
    }
  
    const { error } = await supabase
      .from('pedidos')
      .update({ estado })
      .eq('id', id)
      .eq('empresa_id', empresa.id);
  
    if (error) {
      alert(error.message);
      return;
    }
  
    cargarPedidos();
  }

  async function cargarPedidos() {
    setLoading(true);
  
    const empresa = await obtenerEmpresaActual();
  
    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      setLoading(false);
      return;
    }
  
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('empresa_id', empresa.id)
      .order('created_at', {
        ascending: false,
      });
  
    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }
  
    setPedidos((data as Pedido[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    cargarPedidos();
  }, []);

  

  const ventasTotales = pedidos.reduce(
    (acc, pedido) => acc + pedido.total,
    0
  );
  
  const pendientes = pedidos.filter(
    (p) => p.estado === 'pendiente'
  ).length;
  
  const listos = pedidos.filter(
    (p) => p.estado === 'listo'
  ).length;
  
  const entregados = pedidos.filter(
    (p) => p.estado === 'entregado'
  ).length;
  
  const hoy = new Date().toISOString().slice(0, 10);
  
  const ventasHoy = pedidos
    .filter((p) => p.created_at?.slice(0, 10) === hoy)
    .reduce((acc, pedido) => acc + pedido.total, 0);
  
  const mesActual = new Date().toISOString().slice(0, 7);
  
  const ventasMes = pedidos
    .filter((p) => p.created_at?.slice(0, 7) === mesActual)
    .reduce((acc, pedido) => acc + pedido.total, 0);
  
  const ticketPromedio =
    pedidos.length > 0
      ? ventasTotales / pedidos.length
      : 0;

      const pedidosFiltrados =
      filtroEstado === 'todos'
        ? pedidos
        : pedidos.filter(
            (pedido) =>
              pedido.estado === filtroEstado
          );   

  return (
    <main className="min-h-screen bg-maruxa-crema px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <p className="font-black uppercase tracking-[.24em] text-maruxa-rojo">
            Administración
          </p>

          <h1 className="mt-3 text-5xl font-black text-maruxa-chocolate">
            Pedidos Maruxa
          </h1>

          <p className="mt-3 font-bold text-maruxa-cafe/70">
            {pedidos.length} pedidos registrados
          </p>

                        <p className="mt-3 font-bold text-maruxa-cafe/70">
                {pedidos.length} pedidos registrados
                </p>

                {/* DASHBOARD */}

                <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                ...
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                ...
                </div>

                

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[28px] bg-white p-6 shadow-premium">
                <p className="text-xs font-black uppercase tracking-widest text-maruxa-cafe/60">
                Ventas Totales
                </p>

                <p className="mt-2 text-3xl font-black text-maruxa-vino">
                ${ventasTotales.toLocaleString('es-CL')}
                </p>
            </div>

            <div className="rounded-[28px] bg-white p-6 shadow-premium">
                <p className="text-xs font-black uppercase tracking-widest text-maruxa-cafe/60">
                Pedidos
                </p>

                <p className="mt-2 text-3xl font-black text-maruxa-chocolate">
                {pedidos.length}
                </p>
            </div>

            <div className="rounded-[28px] bg-white p-6 shadow-premium">
                <p className="text-xs font-black uppercase tracking-widest text-yellow-700">
                Pendientes
                </p>

                <p className="mt-2 text-3xl font-black text-yellow-700">
                {pendientes}
                </p>
            </div>

            <div className="rounded-[28px] bg-white p-6 shadow-premium">
                <p className="text-xs font-black uppercase tracking-widest text-green-700">
                Entregados
                </p>

                <p className="mt-2 text-3xl font-black text-green-700">
                {entregados}
                </p>
            </div>
            </div>

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="mt-5 rounded-2xl border border-maruxa-rojo/10 bg-white px-5 py-3 font-black text-maruxa-chocolate"
            >
            <option value="todos">Todos los pedidos</option>
            <option value="pendiente">Pendientes</option>
            <option value="listo">Listos para retiro</option>
            <option value="entregado">Entregados</option>
            </select>
        </div>

        {loading && (
          <div className="rounded-[28px] bg-white p-6 font-black shadow-premium">
            Cargando pedidos...
          </div>
        )}

        <div className="grid gap-5">
        {pedidosFiltrados.map((pedido) => (
            <article
              key={pedido.id}
              className="rounded-[34px] bg-white p-6 shadow-premium"
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                <div className="flex items-center gap-3">
                        <p className="text-xs font-black uppercase tracking-widest text-maruxa-rojo">
                            Pedido #{pedido.id}
                        </p>

                        <span 
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                                pedido.estado === 'pendiente'
                                ? 'bg-yellow-100 text-yellow-800'
                                : pedido.estado === 'listo'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                        >
                            {pedido.estado}
                        </span>
                        </div>

                  <h2 className="mt-2 text-3xl font-black text-maruxa-chocolate">
                    {pedido.cliente}
                  </h2>

                  <div className="mt-4 space-y-2 text-sm font-bold text-maruxa-cafe/80">
                    <p>
                      Teléfono: {pedido.telefono}
                    </p>

                    <p>
                      Retiro:{' '}
                      {pedido.fecha_retiro}
                    </p>

                    <p>
                      Hora:{' '}
                      {pedido.hora_retiro}
                    </p>

                    {pedido.observaciones && (
                      <p>
                        Observaciones:{' '}
                        {pedido.observaciones}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] bg-maruxa-crema p-6 min-w-[260px]">
  <p className="text-xs font-black uppercase tracking-widest text-maruxa-cafe/60">
    Total
  </p>

  <p className="mt-2 text-4xl font-black text-maruxa-vino">
    $
    {pedido.total.toLocaleString('es-CL')}
  </p>

  <select
  value={pedido.estado || 'pendiente'}
  onChange={(e) =>
    cambiarEstado(
      pedido.id,
      e.target.value
    )
  }
  className="mt-5 w-full rounded-2xl border border-maruxa-rojo/10 bg-white px-4 py-3 font-black"
>
  <option value="pendiente">
    Pendiente
  </option>

  <option value="listo">
    Listo para retiro
  </option>

  <option value="entregado">
    Entregado
  </option>
</select>

  <a
    href={`https://wa.me/${pedido.telefono.replace(
      /\D/g,
      ''
    )}?text=${encodeURIComponent(
      `Hola ${pedido.cliente}, te contactamos desde Panadería Maruxa respecto a tu pedido #${pedido.id}.`
    )}`}
    target="_blank"
    rel="noreferrer"
    className="mt-3 block w-full rounded-2xl bg-green-600 px-4 py-3 text-center font-black text-white transition hover:opacity-90"
  >
    WhatsApp Cliente
  </a>
</div>
              </div>

              <div className="mt-8 rounded-[28px] bg-maruxa-crema p-5">
                <p className="text-xs font-black uppercase tracking-widest text-maruxa-rojo">
                  Productos
                </p>

                <div className="mt-4 space-y-3">
                  {pedido.productos?.map(
                    (producto, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-[20px] bg-white px-4 py-4"
                      >
                        <div className="flex items-center gap-4">
                        {producto.imagen && (
                            <img
                            src={producto.imagen}
                            alt={producto.nombre}
                            className="h-16 w-16 rounded-2xl object-cover"
                            />
                        )}

                        <div>
                            <p className="font-black text-maruxa-chocolate">
                            {producto.nombre}
                            </p>

                            {producto.tamano && (
                            <p className="text-sm font-bold text-maruxa-cafe/70">
                                {producto.tamano}
                            </p>
                            )}

                            <p className="text-sm font-bold text-maruxa-cafe/70">
                            Cantidad: {producto.cantidad}
                            </p>
                        </div>
                        </div>

                        <p className="font-black text-maruxa-vino">
                          $
                          {(
                            producto.precio *
                            producto.cantidad
                          ).toLocaleString(
                            'es-CL'
                          )}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
