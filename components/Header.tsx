'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronRight,
  Facebook,
  Instagram,
  LogIn,
  Menu,
  MessageCircle,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useCart } from '@/lib/cart';
import { facebook, instagram, whatsapp } from '@/lib/datos';

const mensaje = encodeURIComponent(
  'Hola Maruxa, quiero hacer un pedido para retiro en local.'
);

export function Header() {
  const [open, setOpen] = useState(false);
  const items = useCart((s) => s.items);

  const cantidad = items.reduce((acc, item) => acc + item.cantidad, 0);

  useEffect(() => {
    if (!open) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function cerrarConEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('keydown', cerrarConEscape);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener('keydown', cerrarConEscape);
    };
  }, [open]);

  const links = [
    { href: '/#catalogo', label: 'Catálogo' },
    {
      href: '/?categoria=Pastelería&subfamilia=Tortas#catalogo',
      label: 'Tortas',
    },
    { href: '/#retiro', label: 'Retiro' },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-maruxa-cafe/10 bg-maruxa-crema/85 backdrop-blur-2xl">
      <div className="contenedor flex min-h-20 items-center justify-between py-2 sm:min-h-24">
          <Link href="/" className="flex items-center gap-4">
            <Image
              src="/logo-maruxa.png"
              alt="Panadería Maruxa"
              width={170}
              height={70}
              className="h-auto w-[128px] object-contain sm:w-[170px]"
              priority
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

          <div className="hidden items-center gap-2 lg:flex">
            <a
              href={`https://wa.me/${whatsapp}?text=${mensaje}`}
              target="_blank"
              rel="noreferrer"
              className="grid h-11 w-11 place-items-center rounded-full bg-white text-green-700 shadow-sm transition hover:bg-green-50"
              title="WhatsApp"
            >
              <MessageCircle size={18} />
            </a>

            <a
              href={instagram}
              target="_blank"
              rel="noreferrer"
              className="grid h-11 w-11 place-items-center rounded-full bg-white text-maruxa-vino shadow-sm transition hover:bg-red-50"
              title="Instagram"
            >
              <Instagram size={18} />
            </a>

            <a
              href={facebook}
              target="_blank"
              rel="noreferrer"
              className="grid h-11 w-11 place-items-center rounded-full bg-white text-blue-700 shadow-sm transition hover:bg-blue-50"
              title="Facebook"
            >
              <Facebook size={18} />
            </a>

            <a href="/#catalogo" className="btn-rojo relative flex items-center gap-2">
              <ShoppingBag size={18} />
              Comprar
              {cantidad > 0 && (
                <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-xs font-black text-maruxa-rojo">
                  {cantidad}
                </span>
              )}
            </a>

            <Link
              href="/admin/login"
              className="flex h-11 items-center gap-2 px-3 text-xs font-black uppercase text-maruxa-cafe/75 transition hover:text-maruxa-rojo"
              title="Ingresar a Maruxa ERP"
            >
              <LogIn size={17} />
              Acceso ERP
            </Link>
          </div>

          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={open}
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
          className={`absolute right-0 top-0 h-[100dvh] w-[92%] max-w-[420px] overflow-y-auto overscroll-contain bg-maruxa-crema shadow-2xl transition duration-300 sm:w-[88%] ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-maruxa-rojo/10 bg-maruxa-crema/95 px-4 backdrop-blur sm:h-20 sm:px-6">
            <Image src="/logo-maruxa.png" alt="Maruxa" width={140} height={60} className="object-contain" 
               style={{
                width: 'auto',
                height: 'auto',
              }}/>

            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar menu"
              className="grid h-11 w-11 place-items-center rounded-full border border-maruxa-rojo/10 bg-white"
            >
              <X />
            </button>
          </div>

          <div className="flex flex-col gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-3 sm:p-6">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-[20px] border border-maruxa-rojo/10 bg-white px-4 py-4 text-base font-black text-maruxa-chocolate transition hover:border-maruxa-rojo/30 sm:rounded-[24px] sm:px-5 sm:py-5 sm:text-lg"
              >
                {l.label}
                <ChevronRight size={20} />
              </Link>
            ))}

            <Link
              href="/admin/login"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-[20px] border border-maruxa-rojo/10 bg-white px-4 py-4 text-base font-black text-maruxa-chocolate transition hover:border-maruxa-rojo/30 sm:rounded-[24px] sm:px-5 sm:py-5 sm:text-lg"
            >
              <span className="flex items-center gap-3">
                <LogIn size={20} />
                Acceso ERP
              </span>
              <ChevronRight size={20} />
            </Link>

            <a href={`https://wa.me/${whatsapp}?text=${mensaje}`} className="btn-rojo mt-5 text-center">
              WhatsApp Maruxa
            </a>

            <div className="grid grid-cols-2 gap-3">
              <a
                href={instagram}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-[20px] bg-white px-4 py-4 font-black text-maruxa-vino"
              >
                <Instagram size={19} />
                Instagram
              </a>

              <a
                href={facebook}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-[20px] bg-white px-4 py-4 font-black text-blue-700"
              >
                <Facebook size={19} />
                Facebook
              </a>
            </div>

            <div className="mt-3 rounded-[24px] bg-white p-4 sm:mt-6 sm:rounded-[30px] sm:p-6">
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
