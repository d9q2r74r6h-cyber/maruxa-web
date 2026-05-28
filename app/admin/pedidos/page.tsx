'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

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
    tamano?: string;
  }[];
  created_at?: string;
};

const CLAVE_ADMIN = 'maruxa1962';

export default function AdminPedidosPage() {
  const [clave, setClave] = useState('');
  const [autorizado, setAutorizado] = useState(false);

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  async function cambiarEstado(id: number, estado: string) {
    const { error } = await supabase
      .from('pedidos')
      .update({ estado })
      .eq('id', id);
  
    if (error) {
      alert(error.message);
      return;
    }
  
    cargarPedidos();
  }

  async function cargarPedidos() {
    setLoading(true);

    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
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
    if (autorizado) {
      cargarPedidos();
    }
  }, [autorizado]);

  function entrar() {
    if (clave === CLAVE_ADMIN) {
      setAutorizado(true);
      return;
    }

    alert('Clave incorrecta');
  }

  if (!autorizado) {
    return (
      <main className="min-h-screen bg-maruxa-crema px-5 py-20">
        <div className="mx-auto max-w-md rounded-[34px] bg-white p-8 shadow-premium">
          <h1 className="text-4xl font-black text-maruxa-chocolate">
            Admin Pedidos
          </h1>

          <input
            type="password"
            placeholder="Clave admin"
            value={clave}
            onChange={(e) =>
              setClave(e.target.value)
            }
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  entrar();
                }
              }}
            className="mt-8 w-full rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
          />

          <button
            onClick={entrar}
            className="mt-5 w-full rounded-full bg-maruxa-rojo px-5 py-4 font-black text-white"
          >
            Entrar
          </button>
        </div>
      </main>
    );
  }

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
        </div>

        {loading && (
          <div className="rounded-[28px] bg-white p-6 font-black shadow-premium">
            Cargando pedidos...
          </div>
        )}

        <div className="grid gap-5">
          {pedidos.map((pedido) => (
            <article
              key={pedido.id}
              className="rounded-[34px] bg-white p-6 shadow-premium"
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-maruxa-rojo">
                    Pedido #{pedido.id}
                  </p>

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

                <div className="rounded-[28px] bg-maruxa-crema p-6">
                  <p className="text-xs font-black uppercase tracking-widest text-maruxa-cafe/60">
                    Total
                  </p>

                  <p className="mt-2 text-4xl font-black text-maruxa-vino">
                    $
                    {pedido.total.toLocaleString(
                      'es-CL'
                    )}
                  </p>
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
                            Cantidad:{' '}
                            {producto.cantidad}
                          </p>
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