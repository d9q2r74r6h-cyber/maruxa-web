'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';

import {
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';

import { useCart } from '@/lib/cart';

export function CartDrawer() {
  const [open, setOpen] = useState(false);

  const {
    items,
    increase,
    decrease,
    removeItem,
    clearCart,
  } = useCart();

  const total = useMemo(() => {
    return items.reduce(
      (acc, item) =>
        acc + item.precio * item.cantidad,
      0
    );
  }, [items]);

  const cantidadTotal = useMemo(() => {
    return items.reduce(
      (acc, item) => acc + item.cantidad,
      0
    );
  }, [items]);

  const mensaje = encodeURIComponent(
    `Hola Maruxa, quiero hacer este pedido:%0A%0A` +
      items
        .map(
          (i) =>
            `• ${i.nombre} ${
              i.tamano ? `(${i.tamano})` : ''
            } x${i.cantidad}`
        )
        .join('%0A') +
      `%0A%0ATotal: $${total.toLocaleString('es-CL')}`
  );

  return (
    <>
      <button
  onClick={() => setOpen(true)}
  className={`fixed bottom-5 right-5 z-[90] flex items-center gap-3 rounded-full bg-[#8f2028] px-6 py-5 text-base font-black text-white shadow-[0_18px_45px_rgba(143,32,40,0.45)] ring-4 ring-white transition hover:scale-105 active:scale-95 lg:bottom-8 lg:right-8 ${
    cantidadTotal > 0 ? 'animate-pulse' : ''
  }`}>
<ShoppingBag
  size={20}
  className={cantidadTotal > 0 ? 'animate-bounce' : ''}
/>

  <span>
    {cantidadTotal} producto
    {cantidadTotal !== 1 ? 's' : ''}
  </span>

  {cantidadTotal > 0 && (
    <span className="rounded-full bg-white/20 px-3 py-1">
      ${total.toLocaleString('es-CL')}
    </span>
  )}
</button>

      <div
        className={`fixed inset-0 z-[120] transition ${
          open
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      >
        <div
          onClick={() => setOpen(false)}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        <div
         className={`absolute right-0 top-0 flex h-full w-full max-w-[500px] flex-col bg-[#F7E8D3] shadow-[0_25px_80px_rgba(0,0,0,0.35)] transition duration-300 ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-maruxa-rojo/10 bg-white/70 p-6 backdrop-blur-md">

            <div>
              <p className="text-xs font-black uppercase tracking-widest text-maruxa-rojo">
                Carrito
              </p>

              <h2 className="mt-1 text-3xl font-black text-maruxa-chocolate">
                Tu pedido
              </h2>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="grid h-11 w-11 place-items-center rounded-full border border-maruxa-rojo/10 bg-white"
            >
              <X />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">

            {items.length === 0 ? (
              <div className="grid h-full place-items-center">
                <div className="text-center">
                  <ShoppingBag
                    size={60}
                    className="mx-auto opacity-30"
                  />

                  <p className="mt-4 text-xl font-black text-maruxa-chocolate">
                    Tu carrito está vacío
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">

                {items.map((item) => (
                  <article
                    key={`${item.id}-${item.tamano}`}
                    className="rounded-[28px] bg-white p-4 shadow-premium"
                  >
                    <div className="flex gap-4">

                      <div className="relative h-24 w-24 overflow-hidden rounded-[22px] bg-maruxa-crema">
                        {item.imagen ? (
                          <Image
                            src={item.imagen}
                            alt={item.nombre}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="grid h-full place-items-center text-4xl">
                            🥐
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col">

                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-black text-maruxa-chocolate">
                              {item.nombre}
                            </h3>

                            {item.tamano && (
                              <p className="text-sm font-bold text-maruxa-cafe/70">
                                {item.tamano}
                              </p>
                            )}
                          </div>

                          <button
                            onClick={() =>
                              removeItem(
                                item.id,
                                item.tamano
                              )
                            }
                            className="opacity-50 transition hover:opacity-100"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        <div className="mt-auto flex items-center justify-between">

                          <div className="flex items-center gap-2">

                            <button
                              onClick={() =>
                                decrease(
                                  item.id,
                                  item.tamano
                                )
                              }
                              className="grid h-9 w-9 place-items-center rounded-full border border-maruxa-rojo/10 bg-maruxa-crema"
                            >
                              <Minus size={16} />
                            </button>

                            <span className="w-6 text-center font-black">
                              {item.cantidad}
                            </span>

                            <button
                              onClick={() =>
                                increase(
                                  item.id,
                                  item.tamano
                                )
                              }
                              className="grid h-9 w-9 place-items-center rounded-full border border-maruxa-rojo/10 bg-maruxa-crema"
                            >
                              <Plus size={16} />
                            </button>

                          </div>

                          <p className="text-lg font-black text-maruxa-vino">
                            $
                            {(
                              item.precio *
                              item.cantidad
                            ).toLocaleString('es-CL')}
                          </p>

                        </div>
                      </div>
                    </div>
                  </article>
                ))}

              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="border-t border-maruxa-rojo/10 bg-white p-6">

              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm font-black uppercase tracking-widest text-maruxa-cafe/60">
                  Total
                </p>

                <p className="text-4xl font-black text-maruxa-vino">
                  ${total.toLocaleString('es-CL')}
                </p>
              </div>

              <div className="grid gap-3">

              <a
  href="/checkout"
  className="btn-rojo text-center"
>
  Ir al checkout
</a>

                <button
                  onClick={clearCart}
                  className="rounded-full border border-maruxa-rojo/10 bg-maruxa-crema px-5 py-4 text-sm font-black text-maruxa-chocolate"
                >
                  Vaciar carrito
                </button>

              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}