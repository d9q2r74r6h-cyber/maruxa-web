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
    <div className="fixed bottom-4 left-1/2 z-[95] w-[92%] max-w-md -translate-x-1/2 lg:hidden">
      <a
        href="/checkout"
        className="flex items-center justify-between rounded-full bg-maruxa-rojo px-6 py-4 text-white shadow-2xl backdrop-blur-xl"
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

        <p className="text-xl font-black">
          ${total.toLocaleString('es-CL')}
        </p>
      </a>
    </div>
  );
}