'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { useCart } from '@/lib/cart';
import { supabasePublic } from '@/lib/supabase-public';
import { obtenerEmpresaActual } from '@/lib/empresa';
import { CalendarioRetiro } from '@/components/CalendarioRetiro';

export function CheckoutPage() {
  const { items, clearCart } = useCart();

  const [loading, setLoading] = useState(false);
  const [fecha, setFecha] = useState<Date>();

  const total = useMemo(() => {
    return items.reduce(
      (acc, item) => acc + item.precio * item.cantidad,
      0
    );
  }, [items]);

  const tieneTortas = useMemo(() => {
    return items.some((item) => item.tamano);
  }, [items]);

  async function finalizar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!fecha) {
      alert('Selecciona una fecha.');
      return;
    }

    if (tieneTortas) {
      const ahora = new Date();
      const diferencia = fecha.getTime() - ahora.getTime();
      const horas = diferencia / (1000 * 60 * 60);

      if (horas < 24) {
        alert('Las tortas requieren mínimo 24 horas de anticipación.');
        return;
      }
    }

    setLoading(true);

    const form = new FormData(e.currentTarget);

    const cliente = String(form.get('cliente'));
    const telefono = String(form.get('telefono'));
    const hora = String(form.get('hora'));
    const observaciones = String(form.get('observaciones'));

    const fechaTexto = format(fecha, 'yyyy-MM-dd');
const fechaWhatsApp = format(fecha, 'dd/MM/yyyy', {
  locale: es,
});




const email = String(form.get('email'));

const empresa = await obtenerEmpresaActual();

if (!empresa) {
  alert('No se pudo identificar la panadería.');
  setLoading(false);
  return;
}

const pedido = {
  cliente,
  email,
  telefono,
  productos: items,
  total,
  fecha_retiro: fechaTexto,
  hora_retiro: hora,
  observaciones,
  estado: 'pendiente',
  empresa_id: empresa.id,
};

const { data: pedidoCreado, error } = await supabasePublic
  .from('pedidos')
  .insert([pedido])
  .select()
  .single();

if (error) {
  console.error('Error guardando pedido:', error);
  alert(`No se pudo guardar el pedido: ${error.message}`);
  setLoading(false);
  return;
}

await fetch('/api/enviar-pedido', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(pedidoCreado),
});

try {
  await fetch('/api/easypan/pedido', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pedidoCreado),
  });
} catch (error) {
  console.error('Error enviando pedido a EasyPan:', error);
}
    

   

    clearCart();

    window.location.href =
    `/pedido-exitoso?total=${total}&cliente=${encodeURIComponent(
      cliente
    )}&telefono=${encodeURIComponent(
      telefono
    )}&fecha=${encodeURIComponent(
      fechaWhatsApp
    )}&hora=${encodeURIComponent(
      hora
    )}&observaciones=${encodeURIComponent(
      observaciones
    )}`;
  }

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-maruxa-crema py-24">
        <div className="contenedor text-center">
          <h1 className="text-5xl font-black text-maruxa-chocolate">
            Tu carrito está vacío
          </h1>
  
          <p className="mt-4 font-bold text-maruxa-cafe/70">
            Agrega productos antes de continuar al pago.
          </p>
  
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="cursor-pointer btn-rojo"
            >
              Volver al producto
            </button>
  
            <a
              href="/"
              className="btn-rojo"
            >
              Ver catálogo
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-maruxa-crema py-20">
      <div className="contenedor grid gap-10 lg:grid-cols-[1fr_420px]">
        <div>
          <a
            href="/"
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-maruxa-chocolate shadow-premium transition hover:scale-105"
          >
            ← Seguir comprando
          </a>

          <p className="font-black uppercase tracking-[.24em] text-maruxa-rojo">
            Checkout Maruxa
          </p>

          <h1 className="mt-4 text-6xl font-black tracking-[-.05em] text-maruxa-chocolate">
            Finalizar pedido
          </h1>

          {tieneTortas && (
            <div className="mt-6 rounded-[24px] border border-maruxa-rojo/10 bg-white p-5 font-bold text-maruxa-chocolate shadow-premium">
              Las tortas requieren mínimo 24 horas de anticipación para retiro.
            </div>
          )}

          <form onSubmit={finalizar} className="mt-10 space-y-6">
            <input
              name="cliente"
              required
              placeholder="Nombre"
              className="w-full rounded-[24px] border border-maruxa-rojo/10 bg-white px-5 py-5 font-bold outline-none"
            />

            <input
              name="telefono"
              required
              placeholder="Teléfono"
              className="w-full rounded-[24px] border border-maruxa-rojo/10 bg-white px-5 py-5 font-bold outline-none"
            />

            <div className="rounded-[24px] bg-white p-4 shadow-premium">
              <div className="mx-auto w-fit">
                <CalendarioRetiro fecha={fecha} setFecha={setFecha} />
              </div>
            </div>

            <input
              name="hora"
              type="time"
              required
              className="w-full rounded-[24px] border border-maruxa-rojo/10 bg-white px-5 py-5 font-bold outline-none"
            />

            <input
              name="email"
              type="email"
              required
              placeholder="Correo electrónico"
              className="w-full rounded-[24px] border border-maruxa-rojo/10 bg-white px-5 py-5 font-bold outline-none"
            />

            <textarea
              name="observaciones"
              placeholder="Observaciones"
              className="min-h-[160px] w-full rounded-[24px] border border-maruxa-rojo/10 bg-white px-5 py-5 font-bold outline-none"
            />

            <button disabled={loading} className="btn-rojo w-full">
              {loading ? 'Procesando...' : 'Confirmar pedido'}
            </button>
          </form>
        </div>

        <aside className="card-premium top-24 h-fit rounded-[40px] p-6 lg:sticky">
          <h2 className="text-3xl font-black text-maruxa-chocolate">
            Resumen
          </h2>

          <div className="mt-6 space-y-4">
            {items.map((item) => (
              <div
                key={`${item.id}-${item.tamano}`}
                className="rounded-[24px] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black">{item.nombre}</h3>

                    {item.tamano && (
                      <p className="text-sm font-bold text-maruxa-cafe/70">
                        {item.tamano}
                      </p>
                    )}

                    <p className="mt-2 text-sm font-bold">
                      Cantidad: {item.cantidad}
                    </p>
                  </div>

                  <p className="font-black text-maruxa-vino">
                    ${(item.precio * item.cantidad).toLocaleString('es-CL')}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-maruxa-rojo/10 pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black uppercase tracking-widest text-maruxa-cafe/60">
                Total
              </p>

              <p className="text-4xl font-black text-maruxa-vino">
                ${total.toLocaleString('es-CL')}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
