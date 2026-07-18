'use client';

import { ShoppingBag } from 'lucide-react';
import { useMemo } from 'react';
import { useCart } from '@/lib/cart';

export function MobileCartBar() {
  const items = useCart((s) => s.items);

  const total = useMemo(() => {
    return items.reduce(
      (acc, item) =>
        acc + item.precio * item.cantidad,
      0
    );
  }, [items]);

  const cantidad = useMemo(() => {
    return items.reduce(
      (acc, item) => acc + item.cantidad,
      0
    );
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[95] w-[calc(100%_-_1.5rem)] max-w-md -translate-x-1/2 lg:hidden">
      <a
        href="/checkout"
        className="flex items-center justify-between gap-3 rounded-full bg-maruxa-rojo px-4 py-3 text-white shadow-2xl backdrop-blur-xl sm:px-6 sm:py-4"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-white/20">
            <ShoppingBag size={20} />
          </div>

          <div>
            <p className="text-sm font-black">
              {cantidad} producto
              {cantidad !== 1 ? 's' : ''}
            </p>

            <p className="text-xs font-bold text-white/75">
              Ver carrito
            </p>
          </div>
        </div>

        <p className="shrink-0 text-lg font-black sm:text-xl">
          ${total.toLocaleString('es-CL')}
        </p>
      </a>
    </div>
  );
}
