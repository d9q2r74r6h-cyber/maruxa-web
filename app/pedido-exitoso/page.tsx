'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, Check, Copy, Mail, MapPin } from 'lucide-react';
import { whatsapp } from '@/lib/datos';
import { MARUXA } from '@/lib/marca';
import { DatosTransferencia } from '@/components/DatosTransferencia';

function PedidoExitosoContent() {
  const params = useSearchParams();
  const [pedidoCopiado, setPedidoCopiado] = useState(false);

  const totalParametro = Number(params.get('total'));
  const total = Number.isFinite(totalParametro) && totalParametro > 0 ? totalParametro : 0;
  const pedidoParametro = Number(params.get('pedido'));
  const numeroPedido = Number.isSafeInteger(pedidoParametro) && pedidoParametro > 0
    ? pedidoParametro
    : null;
  const cliente = params.get('cliente') || '';
  const telefono = params.get('telefono') || '';
  const fecha = params.get('fecha') || '';
  const hora = params.get('hora') || '';
  const observaciones = params.get('observaciones') || '';
  const email = params.get('email') || '';
  const avisoCorreo = params.get('aviso_correo') === '1';
  const mensajeWhatsApp = encodeURIComponent(
    `Hola Maruxa, quiero consultar mi pedido${numeroPedido ? ` #${numeroPedido}` : ''}.`
  );

  async function copiarNumeroPedido() {
    if (!numeroPedido) return;
    try {
      await navigator.clipboard.writeText(`Pedido #${numeroPedido}`);
      setPedidoCopiado(true);
      window.setTimeout(() => setPedidoCopiado(false), 2200);
    } catch {
      setPedidoCopiado(false);
    }
  }

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
            Solicitud recibida{numeroPedido ? ` · Pedido #${numeroPedido}` : ''}
          </p>

          <h1 className="mt-4 text-center text-4xl font-black tracking-[-.05em] text-maruxa-chocolate sm:text-6xl">
            ¡Recibimos tu solicitud!
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-center text-lg font-bold leading-8 text-maruxa-cafe/75">
            Revisaremos la disponibilidad y confirmaremos tu pedido antes de prepararlo.
          </p>

          {numeroPedido && (
            <div className="mx-auto mt-7 flex max-w-md flex-col items-center justify-between gap-4 rounded-[24px] border border-maruxa-rojo/15 bg-maruxa-rojo/5 p-4 text-center sm:flex-row sm:text-left">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-maruxa-cafe/60">
                  Número de pedido
                </p>
                <p className="mt-1 text-2xl font-black text-maruxa-vino">
                  #{numeroPedido}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copiarNumeroPedido()}
                className="inline-flex items-center gap-2 rounded-full border border-maruxa-rojo/20 bg-white px-4 py-3 text-sm font-black text-maruxa-rojo transition hover:bg-maruxa-rojo/10"
              >
                {pedidoCopiado ? <Check size={17} /> : <Copy size={17} />}
                {pedidoCopiado ? 'Número copiado' : 'Copiar número'}
              </button>
            </div>
          )}

          <div className="mt-10 rounded-[30px] bg-maruxa-crema p-8">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black uppercase tracking-widest text-maruxa-cafe/60">
                Total pedido
              </p>

              <p className="text-5xl font-black text-maruxa-vino">
                ${total.toLocaleString('es-CL')}
              </p>
            </div>
          </div>

          {avisoCorreo ? (
            <div className="mt-6 rounded-[24px] border border-amber-300 bg-amber-50 p-5 text-sm font-bold leading-6 text-amber-950">
              Guardamos tu solicitud, pero no pudimos enviar el correo de respaldo. Escríbenos por WhatsApp indicando tu número de pedido para confirmar.
            </div>
          ) : (
            <div className="mt-6 flex gap-3 rounded-[24px] border border-green-200 bg-green-50 p-5 text-sm font-bold leading-6 text-green-950">
              <Mail className="h-5 w-5 shrink-0 text-green-700" />
              <p>Enviamos un comprobante a <span className="font-black">{email}</span>. Revisa también tu carpeta de correo no deseado.</p>
            </div>
          )}

          <div className="mt-8 rounded-[30px] bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-black text-maruxa-chocolate">
              Datos del retiro
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

              {email && (
                  <p>
                    <span className="font-black text-maruxa-chocolate">
                      Email:
                    </span>{' '}
                    {email}
                  </p>
                )}

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

          <div className="mt-10 rounded-[32px] border-2 border-maruxa-rojo bg-maruxa-rojo/5 p-5 shadow-premium">
              <div className="grid gap-4 md:grid-cols-2">
                <Link
                  href="/"
                  className="block rounded-full bg-maruxa-rojo px-8 py-5 text-center text-lg font-black text-white shadow-premium transition hover:scale-[1.02]"
                >
                  Seguir comprando
                </Link>

                <a
                  href={`https://wa.me/${whatsapp}?text=${mensajeWhatsApp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-full border border-maruxa-rojo/20 bg-maruxa-crema px-8 py-5 text-center text-lg font-black text-maruxa-rojo shadow-premium transition hover:bg-white"
                >
                  ¿Necesitas ayuda?
                </a>
              </div>
            </div>
          <div className="mt-6">
            <DatosTransferencia referencia={numeroPedido ? `Pedido #${numeroPedido}` : undefined} />
          </div>
          <div className="mt-10 grid gap-3 rounded-[24px] border border-maruxa-rojo/10 bg-white p-6 text-sm font-bold leading-6 text-maruxa-cafe/75 sm:grid-cols-3">
            <p className="flex gap-2"><Mail className="h-5 w-5 shrink-0 text-maruxa-rojo" />Revisamos tu solicitud y confirmamos disponibilidad.</p>
            <p className="flex gap-2"><CalendarDays className="h-5 w-5 shrink-0 text-maruxa-rojo" />Las tortas requieren al menos 24 horas de anticipación.</p>
            <p className="flex gap-2"><MapPin className="h-5 w-5 shrink-0 text-maruxa-rojo" />Retiras en {MARUXA.direccion}.</p>
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
