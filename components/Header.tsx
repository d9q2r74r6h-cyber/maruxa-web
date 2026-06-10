'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, ShoppingBag, X, ChevronRight } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { whatsapp } from '@/lib/datos';

const mensaje = encodeURIComponent(
  'Hola Maruxa, quiero hacer un pedido para retiro en local.'
);

export function Header() {
  const [open, setOpen] = useState(false);
  const items = useCart((s) => s.items);

  const cantidad = items.reduce((acc, item) => acc + item.cantidad, 0);

  const links = [
    { href: '/#catalogo', label: 'Catálogo' },
    { href: '/?categoria=Tortas#catalogo', label: 'Tortas' },
    { href: '/#retiro', label: 'Retiro' },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-maruxa-cafe/10 bg-maruxa-crema/85 backdrop-blur-2xl">
      <div className="contenedor flex min-h-24 items-center justify-between py-2">
          <Link href="/" className="flex items-center gap-4">
            <Image
              src="/logo-maruxa.png"
              alt="Panadería Maruxa"
              width={170}
              height={70}
              className="object-contain"
              priority
              style={{
                width: 'auto',
                height: 'auto',
              }}
            />
          </Link>

          <nav className="hidden items-center gap-5 text-[12px] font-black uppercase tracking-[.14em] text-maruxa-cafe/80 lg:flex">
            {links.map((l) => (
              <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-2 py-2 transition hover:bg-white/60 hover:text-maruxa-rojo"
            >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex">
            <a href="/#catalogo" className="btn-rojo relative flex items-center gap-2">
              <ShoppingBag size={18} />
              Comprar
              {cantidad > 0 && (
                <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-xs font-black text-maruxa-rojo">
                  {cantidad}
                </span>
              )}
            </a>
          </div>

          <button
            onClick={() => setOpen(true)}
            className="relative grid h-12 w-12 place-items-center rounded-full border border-maruxa-rojo/10 bg-white text-maruxa-chocolate lg:hidden"
          >
            <Menu />
            {cantidad > 0 && (
              <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-maruxa-rojo text-xs font-black text-white">
                {cantidad}
              </span>
            )}
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-[100] transition ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

        <div
          className={`absolute right-0 top-0 h-full w-[88%] max-w-[420px] bg-maruxa-crema shadow-2xl transition duration-300 ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex h-20 items-center justify-between border-b border-maruxa-rojo/10 px-6">
            <Image src="/logo-maruxa.png" alt="Maruxa" width={140} height={60} className="object-contain" 
               style={{
                width: 'auto',
                height: 'auto',
              }}/>

            <button
              onClick={() => setOpen(false)}
              className="grid h-11 w-11 place-items-center rounded-full border border-maruxa-rojo/10 bg-white"
            >
              <X />
            </button>
          </div>

          <div className="flex flex-col gap-3 p-6">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-[24px] border border-maruxa-rojo/10 bg-white px-5 py-5 text-lg font-black text-maruxa-chocolate transition hover:border-maruxa-rojo/30"
              >
                {l.label}
                <ChevronRight size={20} />
              </Link>
            ))}

            <a href={`https://wa.me/${whatsapp}?text=${mensaje}`} className="btn-rojo mt-5 text-center">
              WhatsApp Maruxa
            </a>

            <div className="mt-6 rounded-[30px] bg-white p-6">
              <p className="text-xs font-black uppercase tracking-widest text-maruxa-rojo">
                Información
              </p>
              <div className="mt-4 space-y-3 text-sm font-bold text-maruxa-cafe/75">
                <p>• Retiro en local</p>
                <p>• Tortas con 24h mínimo</p>
                <p>• Confirmación vía WhatsApp</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}