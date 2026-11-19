'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, Clock3, MapPin, Minus, Plus, ShieldCheck, Trash2 } from 'lucide-react';

import { useCart } from '@/lib/cart';
import { CalendarioRetiro } from '@/components/CalendarioRetiro';
import { cumpleAnticipacionRetiro } from '@/lib/retiro';
import { formatearTelefonoChile } from '@/lib/telefonos';
import { MARUXA } from '@/lib/marca';

export function CheckoutPage() {
  const { items, clearCart, decrease, increase, removeItem } = useCart();

  const [loading, setLoading] = useState(false);
  const [fecha, setFecha] = useState<Date>();

  const total = useMemo(() => {
    return items.reduce(
      (acc, item) => acc + item.precio * item.cantidad,
      0
    );
  }, [items]);

  const tieneTortas = useMemo(() => {
    return items.some((item) => item.requiere_anticipacion === true);
  }, [items]);

  async function finalizar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!fecha) {
      alert('Selecciona una fecha.');
      return;
    }

    const form = new FormData(e.currentTarget);
    const hora = String(form.get('hora') || '');

    if (tieneTortas && !cumpleAnticipacionRetiro(fecha, hora)) {
      alert('La fecha y hora de retiro deben ser al menos 24 horas después de este momento. Elige una hora posterior o un día más adelante.');
      return;
    }

    setLoading(true);

    try {
      const cliente = String(form.get('cliente') || '').trim();
      const telefono = formatearTelefonoChile(String(form.get('telefono') || ''));
      const observaciones = String(form.get('observaciones') || '').trim();
      const email = String(form.get('email') || '').trim();
      const fechaTexto = format(fecha, 'yyyy-MM-dd');
      const fechaWhatsApp = format(fecha, 'dd/MM/yyyy', { locale: es });

      const entradaPedido = {
        cliente,
        email,
        telefono,
        sitio_web: String(form.get('sitio_web') || ''),
        fecha_retiro: fechaTexto,
        hora_retiro: hora,
        observaciones,
        items: items.map((item) => ({
          id: item.id,
          cantidad: item.cantidad,
          tamano: item.tamano || null,
          presentacion_id: item.presentacion_id || null,
        })),
      };

      const respuesta = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entradaPedido),
      });
      const resultado = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok || !resultado.pedido) {
        alert(resultado.error || 'No se pudo guardar el pedido.');
        return;
      }

      const pedidoCreado = resultado.pedido as { id: number; total: number };
      const avisoCorreo = resultado.advertencia ? '&aviso_correo=1' : '';
      clearCart();

      window.location.href =
        `/pedido-exitoso?pedido=${pedidoCreado.id}&total=${pedidoCreado.total}&cliente=${encodeURIComponent(
          cliente
        )}&telefono=${encodeURIComponent(
          telefono
        )}&fecha=${encodeURIComponent(
          fechaWhatsApp
        )}&hora=${encodeURIComponent(
          hora
        )}&observaciones=${encodeURIComponent(
          observaciones
        )}&email=${encodeURIComponent(email)}${avisoCorreo}`;
    } catch {
      alert('No pudimos enviar el pedido. Revisa tu conexión e inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-maruxa-crema py-24">
        <div className="contenedor text-center">
          <h1 className="text-5xl font-black text-maruxa-chocolate">
            Tu carrito está vacío
          </h1>
  
          <p className="mt-4 font-bold text-maruxa-cafe/70">
            Agrega productos antes de continuar con tu pedido.
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
            Pedido en línea · paso 1 de 2
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-[-.05em] text-maruxa-chocolate sm:text-6xl">
            Enviar solicitud de pedido
          </h1>

          <div className="mt-6 grid gap-3 rounded-[26px] border border-maruxa-rojo/10 bg-white p-5 text-maruxa-chocolate shadow-premium sm:grid-cols-2">
            <div className="flex gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-maruxa-rojo/10 text-maruxa-rojo">
                <MapPin size={20} />
              </span>
              <div>
                <p className="font-black">Retiro en local</p>
                <p className="mt-1 text-sm font-bold text-maruxa-cafe/70">
                  {MARUXA.direccion}. No realizamos delivery.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-maruxa-rojo/10 text-maruxa-rojo">
                <ShieldCheck size={20} />
              </span>
              <div>
                <p className="font-black">Confirmación posterior</p>
                <p className="mt-1 text-sm font-bold text-maruxa-cafe/70">
                  No se realiza cobro online en este paso. Confirmamos disponibilidad contigo.
                </p>
              </div>
            </div>
          </div>

          {tieneTortas && (
            <div className="mt-6 rounded-[24px] border border-maruxa-rojo/10 bg-white p-5 font-bold text-maruxa-chocolate shadow-premium">
              Las tortas requieren mínimo 24 horas de anticipación para retiro.
            </div>
          )}

          <form onSubmit={finalizar} className="mt-10 space-y-6">
            <div className="hidden" aria-hidden="true">
              <label htmlFor="sitio_web">Sitio web</label>
              <input
                id="sitio_web"
                name="sitio_web"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-black text-maruxa-chocolate">Tu nombre</span>
                <input
                  name="cliente"
                  required
                  autoComplete="name"
                  placeholder="Ej. Camila González"
                  className="w-full rounded-[24px] border border-maruxa-rojo/10 bg-white px-5 py-5 font-bold outline-none transition focus:border-maruxa-rojo/50"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-maruxa-chocolate">Teléfono de contacto</span>
                <input
                  name="telefono"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+56 9 9842 8324"
                  className="w-full rounded-[24px] border border-maruxa-rojo/10 bg-white px-5 py-5 font-bold outline-none transition focus:border-maruxa-rojo/50"
                />
              </label>
            </div>

            <div className="rounded-[24px] bg-white p-4 shadow-premium">
              <p className="mb-3 flex items-center gap-2 text-sm font-black text-maruxa-chocolate">
                <CalendarDays size={18} className="text-maruxa-rojo" /> Fecha de retiro
              </p>
              <div className="mx-auto w-fit">
                <CalendarioRetiro fecha={fecha} setFecha={setFecha} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="flex items-center gap-2 text-sm font-black text-maruxa-chocolate">
                  <Clock3 size={18} className="text-maruxa-rojo" /> Hora de retiro
                </span>
                <input
                  name="hora"
                  type="time"
                  required
                  className="w-full rounded-[24px] border border-maruxa-rojo/10 bg-white px-5 py-5 font-bold outline-none transition focus:border-maruxa-rojo/50"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-maruxa-chocolate">Correo de confirmación</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nombre@correo.cl"
                  className="w-full rounded-[24px] border border-maruxa-rojo/10 bg-white px-5 py-5 font-bold outline-none transition focus:border-maruxa-rojo/50"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-black text-maruxa-chocolate">
                Observaciones <span className="font-bold text-maruxa-cafe/55">(opcional)</span>
              </span>
              <textarea
                name="observaciones"
                placeholder="Ej. Sin nueces, mensaje para torta o cualquier detalle de retiro"
                className="min-h-32 w-full rounded-[24px] border border-maruxa-rojo/10 bg-white px-5 py-5 font-bold outline-none transition focus:border-maruxa-rojo/50"
              />
            </label>

            <button disabled={loading} className="btn-rojo w-full">
              {loading ? 'Enviando pedido...' : 'Enviar pedido para confirmación'}
            </button>
          </form>
        </div>

        <aside className="card-premium top-24 h-fit rounded-[40px] p-6 lg:sticky">
          <h2 className="text-3xl font-black text-maruxa-chocolate">
            Resumen
          </h2>
          <p className="mt-2 text-sm font-bold text-maruxa-cafe/70">
            Puedes ajustar las cantidades antes de enviar tu solicitud.
          </p>

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

                  </div>

                  <p className="font-black text-maruxa-vino">
                    ${(item.precio * item.cantidad).toLocaleString('es-CL')}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-maruxa-rojo/10 pt-3">
                  <div className="flex items-center gap-2" aria-label={`Cantidad de ${item.nombre}`}>
                    <button
                      type="button"
                      onClick={() => decrease(item.id, item.tamano)}
                      disabled={item.cantidad <= 1}
                      aria-label={`Restar una unidad de ${item.nombre}`}
                      className="grid h-9 w-9 place-items-center rounded-full border border-maruxa-rojo/10 bg-maruxa-crema text-maruxa-chocolate disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center text-sm font-black">{item.cantidad}</span>
                    <button
                      type="button"
                      onClick={() => increase(item.id, item.tamano)}
                      aria-label={`Sumar una unidad de ${item.nombre}`}
                      className="grid h-9 w-9 place-items-center rounded-full border border-maruxa-rojo/10 bg-maruxa-crema text-maruxa-chocolate"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id, item.tamano)}
                    aria-label={`Quitar ${item.nombre} del pedido`}
                    className="grid h-9 w-9 place-items-center rounded-full text-maruxa-rojo transition hover:bg-maruxa-rojo/10"
                  >
                    <Trash2 size={18} />
                  </button>
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

          <div className="mt-6 rounded-[24px] bg-white p-5 text-sm font-bold leading-6 text-maruxa-cafe/75">
            <p className="font-black text-maruxa-chocolate">¿Qué sigue?</p>
            <ol className="mt-3 space-y-2">
              <li>1. Envías tu solicitud de pedido.</li>
              <li>2. Confirmamos disponibilidad y retiro contigo.</li>
              <li>3. Retiras en {MARUXA.direccion}.</li>
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
}
