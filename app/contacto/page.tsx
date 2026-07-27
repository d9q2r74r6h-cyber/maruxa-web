import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Facebook,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingBag,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { MARUXA } from '@/lib/marca';

const correo = 'pedidos@panaderiamaruxa.cl';
const mensaje = encodeURIComponent(
  'Hola Maruxa, quisiera hacer una consulta.'
);
const direccionMapa = encodeURIComponent(MARUXA.direccion);

export const metadata: Metadata = {
  title: 'Contacto | Panadería Maruxa',
  description:
    'Contacta a Panadería Maruxa por WhatsApp, teléfono, correo o redes sociales. Visítanos en Avenida Santa Rosa 6019, San Miguel.',
  alternates: {
    canonical: '/contacto',
  },
};

const canales = [
  {
    titulo: 'WhatsApp',
    detalle: 'Escríbenos para consultar productos, disponibilidad o pedidos.',
    accion: 'Iniciar conversación',
    href: `https://wa.me/${MARUXA.whatsapp}?text=${mensaje}`,
    icono: MessageCircle,
    color: 'text-green-700',
    externo: true,
  },
  {
    titulo: 'Teléfono',
    detalle: MARUXA.telefono,
    accion: 'Llamar ahora',
    href: `tel:${MARUXA.telefonoLink}`,
    icono: Phone,
    color: 'text-maruxa-rojo',
    externo: false,
  },
  {
    titulo: 'Correo electrónico',
    detalle: correo,
    accion: 'Enviar correo',
    href: `mailto:${correo}?subject=${encodeURIComponent(
      'Consulta desde panaderiamaruxa.cl'
    )}`,
    icono: Mail,
    color: 'text-maruxa-vino',
    externo: false,
  },
];

export default function ContactoPage() {
  return (
    <>
      <Header />

      <main>
        <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,#fff7e8,#f5d9a9_48%,#a51f2b_140%)] py-16 sm:py-24">
          <div className="absolute -right-24 top-8 h-72 w-72 rounded-full bg-maruxa-rojo/15 blur-3xl" />
          <div className="contenedor relative">
            <p className="text-sm font-black uppercase tracking-[.22em] text-maruxa-rojo">
              Estamos para ayudarte
            </p>
            <h1 className="mt-4 max-w-4xl text-balance text-5xl font-black leading-[.95] tracking-[-.04em] text-maruxa-chocolate sm:text-7xl">
              Contacta a Panadería Maruxa
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-maruxa-cafe/80">
              Elige el canal que prefieras para consultar por productos, hacer
              un pedido o coordinar tu retiro en el local.
            </p>
          </div>
        </section>

        <section className="py-14 sm:py-20">
          <div className="contenedor grid gap-5 lg:grid-cols-3">
            {canales.map((canal) => {
              const Icono = canal.icono;

              return (
                <a
                  key={canal.titulo}
                  href={canal.href}
                  target={canal.externo ? '_blank' : undefined}
                  rel={canal.externo ? 'noreferrer' : undefined}
                  className="card-premium group flex min-h-64 flex-col rounded-[30px] p-7 transition hover:-translate-y-1 hover:border-maruxa-rojo/30 sm:p-8"
                >
                  <span className={`grid h-12 w-12 place-items-center rounded-full bg-white ${canal.color}`}>
                    <Icono size={23} />
                  </span>
                  <h2 className="mt-6 text-2xl font-black">{canal.titulo}</h2>
                  <p className="mt-3 flex-1 leading-7 text-maruxa-cafe/75">
                    {canal.detalle}
                  </p>
                  <span className="mt-6 font-black text-maruxa-rojo group-hover:underline">
                    {canal.accion} →
                  </span>
                </a>
              );
            })}
          </div>
        </section>

        <section className="pb-16 sm:pb-24">
          <div className="contenedor grid overflow-hidden rounded-[34px] bg-maruxa-vino text-maruxa-crema shadow-premium lg:grid-cols-[.85fr_1.15fr]">
            <div className="p-8 sm:p-12">
              <MapPin size={30} />
              <p className="mt-7 text-sm font-black uppercase tracking-[.2em] text-maruxa-masa">
                Visítanos
              </p>
              <h2 className="mt-3 text-4xl font-black">Nuestro local</h2>
              <p className="mt-5 text-lg leading-8 text-maruxa-crema/80">
                {MARUXA.direccion}
              </p>
              <p className="mt-4 leading-7 text-maruxa-crema/70">
                Los pedidos se entregan mediante retiro coordinado en el local.
                Confirma disponibilidad y horario antes de venir.
              </p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${direccionMapa}`}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex rounded-full bg-maruxa-crema px-6 py-4 font-black text-maruxa-vino transition hover:-translate-y-0.5"
              >
                Cómo llegar en Google Maps
              </a>
            </div>

            <iframe
              title="Ubicación de Panadería Maruxa"
              src={`https://www.google.com/maps?q=${direccionMapa}&output=embed`}
              className="min-h-[380px] w-full border-0 lg:min-h-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>

        <section className="border-y border-maruxa-cafe/10 bg-white/35 py-14">
          <div className="contenedor flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[.2em] text-maruxa-rojo">
                También estamos en redes
              </p>
              <h2 className="mt-3 text-3xl font-black">
                Sigue las novedades de Maruxa
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={MARUXA.instagram}
                target="_blank"
                rel="noreferrer"
                className="btn-crema inline-flex items-center gap-2 border border-maruxa-cafe/10"
              >
                <Instagram size={19} /> Instagram
              </a>
              <a
                href={MARUXA.facebook}
                target="_blank"
                rel="noreferrer"
                className="btn-crema inline-flex items-center gap-2 border border-maruxa-cafe/10"
              >
                <Facebook size={19} /> Facebook
              </a>
              <Link href="/#catalogo" className="btn-rojo inline-flex items-center gap-2">
                <ShoppingBag size={19} /> Ver catálogo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8">
        <div className="contenedor flex flex-col gap-3 text-sm font-bold text-maruxa-cafe/70 sm:flex-row sm:items-center sm:justify-between">
          <p>Panadería Maruxa · San Miguel</p>
          <Link href="/" className="transition hover:text-maruxa-rojo">
            Volver al inicio
          </Link>
        </div>
      </footer>
    </>
  );
}
