'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function PedidoExitosoContent() {
  const params = useSearchParams();

  const mensaje = params.get('mensaje') || '';
  const total = params.get('total') || '0';

  const cliente = params.get('cliente') || '';
  const telefono = params.get('telefono') || '';
  const fecha = params.get('fecha') || '';
  const hora = params.get('hora') || '';
  const observaciones =
    params.get('observaciones') || '';

  return (
    <main className="min-h-screen bg-maruxa-crema py-20">
      <div className="contenedor max-w-3xl">
        <div className="rounded-[40px] bg-white p-10 shadow-premium">
          <div className="flex justify-center">
            <div className="grid h-24 w-24 place-items-center rounded-full bg-green-100 text-5xl">
              ✅
            </div>
          </div>

          <p className="mt-8 text-center text-sm font-black uppercase tracking-[.24em] text-maruxa-rojo">
            Pedido recibido
          </p>

          <h1 className="mt-4 text-center text-6xl font-black tracking-[-.05em] text-maruxa-chocolate">
            ¡Gracias por tu pedido!
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-center text-lg font-bold leading-8 text-maruxa-cafe/75">
            Tu pedido fue registrado correctamente.
            Ahora puedes confirmar directamente por WhatsApp con Panadería Maruxa.
          </p>

          <div className="mt-10 rounded-[30px] bg-maruxa-crema p-8">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black uppercase tracking-widest text-maruxa-cafe/60">
                Total pedido
              </p>

              <p className="text-5xl font-black text-maruxa-vino">
                ${Number(total).toLocaleString('es-CL')}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-[30px] bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-black text-maruxa-chocolate">
              Datos del pedido
            </h2>

            <div className="mt-6 space-y-4 text-sm font-bold text-maruxa-cafe/80">
              <p>
                <span className="font-black text-maruxa-chocolate">
                  Cliente:
                </span>{' '}
                {cliente}
              </p>

              <p>
                <span className="font-black text-maruxa-chocolate">
                  Teléfono:
                </span>{' '}
                {telefono}
              </p>

              <p>
                <span className="font-black text-maruxa-chocolate">
                  Fecha retiro:
                </span>{' '}
                {fecha}
              </p>

              <p>
                <span className="font-black text-maruxa-chocolate">
                  Hora retiro:
                </span>{' '}
                {hora}
              </p>

              {observaciones && (
                <p>
                  <span className="font-black text-maruxa-chocolate">
                    Observaciones:
                  </span>{' '}
                  {observaciones}
                </p>
              )}
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <a
              href={`https://wa.me/56233663241?text=${mensaje}`}
              className="rounded-full bg-maruxa-rojo px-8 py-5 text-center text-lg font-black text-white shadow-premium transition hover:scale-[1.02]"
            >
              Confirmar por WhatsApp
            </a>

            <Link
              href="/"
              className="rounded-full bg-maruxa-crema px-8 py-5 text-center text-lg font-black text-maruxa-chocolate shadow-sm transition hover:scale-[1.02]"
            >
              Seguir comprando
            </Link>
          </div>

          <div className="mt-10 rounded-[24px] border border-maruxa-rojo/10 bg-white p-6">
            <p className="text-sm font-bold leading-7 text-maruxa-cafe/75">
              • Retiro en local.
              <br />
              • Las tortas requieren mínimo 24 horas.
              <br />
              • El pedido será confirmado vía WhatsApp.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function PedidoExitosoPage() {
  return (
    <Suspense fallback={null}>
      <PedidoExitosoContent />
    </Suspense>
  );
}