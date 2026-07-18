'use client';
import { MobileCartBar } from '@/components/MobileCartBar'; 
import { CartDrawer } from '@/components/CartDrawer';

import Catalogo from '@/components/Catalogo';
import { motion } from 'framer-motion';
import {
  Clock,
  Facebook,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
} from 'lucide-react';

import { facebook, instagram, telefonoVisible, whatsapp } from '@/lib/datos';
import { Suspense } from 'react';


export function Home() {
  const mensaje = encodeURIComponent(
    'Hola Maruxa, quiero hacer un pedido para retiro en local.'
  );

  return (
    <>
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,#fff7e8,#f5d9a9_42%,#a51f2b_100%)]">
        
        <div className="absolute right-[-80px] top-16 h-80 w-80 rounded-full bg-maruxa-rojo/20 blur-3xl" />

        <div className="contenedor grid items-center gap-8 py-12 sm:py-16 lg:min-h-[720px] lg:grid-cols-[1.04fr_.96fr] lg:gap-10 lg:py-20">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
          >
            <p className="mb-5 inline-flex rounded-full bg-white/70 px-4 py-2 text-sm font-black uppercase tracking-[.22em] text-maruxa-vino">
              Panadería artesanal chilena
            </p>

            <h1 className="text-balance text-4xl font-black leading-[.96] tracking-[-.045em] text-maruxa-chocolate sm:text-6xl md:text-8xl md:leading-[.92] md:tracking-[-.06em]">
              El sabor de barrio, elevado a experiencia premium.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-maruxa-cafe/85 sm:mt-7 sm:text-xl sm:leading-8">
              Panes, pastelería y tortas Maruxa con retiro en local.
              Pedidos especiales con mínimo 24 horas de anticipación.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a className="btn-rojo" href="#catalogo">
                Ver catálogo
              </a>

              <a
                className="btn-crema"
                href={`https://wa.me/${whatsapp}?text=${mensaje}`}
              >
                Pedir por WhatsApp
              </a>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={`https://wa.me/${whatsapp}?text=${mensaje}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-3 text-sm font-black text-green-700 shadow-sm transition hover:bg-white"
              >
                <MessageCircle size={18} />
                WhatsApp
              </a>
              <a
                href={instagram}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-3 text-sm font-black text-maruxa-vino shadow-sm transition hover:bg-white"
              >
                <Instagram size={18} />
                Instagram
              </a>
              <a
                href={facebook}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-3 text-sm font-black text-blue-700 shadow-sm transition hover:bg-white"
              >
                <Facebook size={18} />
                Facebook
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="card-premium relative rounded-[32px] p-3 sm:rounded-[48px] sm:p-6"
          >
            <div className="rounded-[26px] bg-maruxa-vino p-5 text-maruxa-crema sm:rounded-[38px] sm:p-8">
              
              <div className="text-[6rem] leading-none sm:text-[10rem]">🥐</div>

              <h2 className="mt-5 text-3xl font-black sm:mt-6 sm:text-4xl">
                Horneado diario
              </h2>

              <p className="mt-3 text-lg text-maruxa-crema/80">
                Vitrina cálida, productos frescos y flujo rápido de pedido.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3">

                <div className="rounded-3xl bg-white/10 p-4">
                  <Clock />
                  <b>24h mínimo</b>
                  <p className="text-sm opacity-75">
                    para tortas
                  </p>
                </div>

                <div className="rounded-3xl bg-white/10 p-4">
                  <MapPin />
                  <b>Retiro local</b>
                  <p className="text-sm opacity-75">
                    sin despacho
                  </p>
                </div>

              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Suspense fallback={<div>Cargando...</div>}>
        <Catalogo />
      </Suspense>

      

      <section id="retiro" className="py-20">
        <div className="contenedor grid gap-6 md:grid-cols-3">

          <div className="card-premium rounded-[30px] p-8">
            <ShieldCheck className="text-maruxa-rojo" />

            <h3 className="mt-4 text-2xl font-black">
              Retiro en local
            </h3>

            <p className="mt-2 text-maruxa-cafe/75">
              Los pedidos se preparan para retiro.
              No se considera delivery en esta etapa.
            </p>
          </div>

          <div className="card-premium rounded-[30px] p-8">
            <Clock className="text-maruxa-rojo" />

            <h3 className="mt-4 text-2xl font-black">
              24 horas mínimo
            </h3>

            <p className="mt-2 text-maruxa-cafe/75">
              Regla principal para tortas y pedidos especiales.
            </p>
          </div>

          <div className="card-premium rounded-[30px] p-8">
            <Phone className="text-maruxa-rojo" />

            <h3 className="mt-4 text-2xl font-black">
              {telefonoVisible}
            </h3>

            <p className="mt-2 text-maruxa-cafe/75">
              Contacto principal            </p>
          </div>

        </div>
      </section>

      <footer className="border-t border-maruxa-cafe/10 py-8">
        <div className="contenedor flex flex-col gap-3 text-sm font-bold text-maruxa-cafe/70 sm:flex-row sm:items-center sm:justify-between">
          <p>Panadería Maruxa · San Miguel</p>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-green-700"
            >
              WhatsApp
            </a>
            <a
              href={instagram}
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-maruxa-rojo"
            >
              Instagram
            </a>
            <a
              href={facebook}
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-blue-700"
            >
              Facebook
            </a>
            <a
              href="/politica-de-privacidad"
              className="transition hover:text-maruxa-rojo"
            >
              Política de privacidad
            </a>
          </div>
        </div>
      </footer>

      <CartDrawer />
      <MobileCartBar />     
    </>
  );
}
