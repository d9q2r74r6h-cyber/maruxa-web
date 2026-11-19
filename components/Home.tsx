'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CakeSlice,
  ChevronLeft,
  ChevronRight,
  Clock,
  Facebook,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import { CartDrawer } from '@/components/CartDrawer';
import Catalogo from '@/components/Catalogo';
import { MobileCartBar } from '@/components/MobileCartBar';
import { facebook, instagram, telefonoVisible, whatsapp } from '@/lib/datos';
import { MARUXA } from '@/lib/marca';

type ProductoHero = {
  id: number;
  nombre: string;
  precio: number;
  categoria: string;
  imagen: string | null;
  slug: string | null;
};

const accesosCatalogo = [
  {
    nombre: 'Panes del día',
    detalle: 'Recién horneados para compartir.',
    href: '/?categoria=Panadería#catalogo',
    icono: ShoppingBag,
  },
  {
    nombre: 'Pastelería',
    detalle: 'Clásicos para una pausa rica.',
    href: '/?categoria=Pastelería#catalogo',
    icono: CakeSlice,
  },
  {
    nombre: 'Tortas',
    detalle: 'Encárgalas con 24 h de anticipación.',
    href: '/?categoria=Pastelería&subfamilia=Tortas#catalogo',
    icono: CakeSlice,
  },
];

export function Home() {
  const mensaje = encodeURIComponent(
    'Hola Maruxa, quiero hacer un pedido para retiro en local.'
  );
  const direccionMapa = encodeURIComponent(MARUXA.direccion);
  const [destacados, setDestacados] = useState<ProductoHero[]>([]);
  const [cargandoDestacados, setCargandoDestacados] = useState(true);
  const [indiceDestacado, setIndiceDestacado] = useState(0);
  const productoDestacado = destacados[indiceDestacado] || destacados[0];

  useEffect(() => {
    let activo = true;

    async function cargarDestacados() {
      try {
        const respuesta = await fetch('/api/catalogo?limite=12', {
          cache: 'no-store',
        });
        const resultado = await respuesta.json();

        if (activo && respuesta.ok) {
          setDestacados((resultado.productos || []) as ProductoHero[]);
          setIndiceDestacado(0);
        }
      } catch {
        // El bloque conserva una alternativa de marca si el catálogo no responde.
      } finally {
        if (activo) setCargandoDestacados(false);
      }
    }

    void cargarDestacados();
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (destacados.length <= 1) return;

    const intervalo = window.setInterval(() => {
      setIndiceDestacado((indiceActual) =>
        (indiceActual + 1) % destacados.length
      );
    }, 6000);

    return () => window.clearInterval(intervalo);
  }, [destacados.length]);

  function cambiarDestacado(direccion: -1 | 1) {
    setIndiceDestacado((indiceActual) =>
      (indiceActual + direccion + destacados.length) % destacados.length
    );
  }

  return (
    <>
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,#fff7e8,#f5d9a9_42%,#a51f2b_130%)]">
        <div className="absolute -left-20 top-44 h-72 w-72 rounded-full bg-white/45 blur-3xl" />
        <div className="absolute right-[-80px] top-16 h-80 w-80 rounded-full bg-maruxa-rojo/20 blur-3xl" />

        <div className="contenedor relative grid items-center gap-8 py-12 sm:py-16 lg:min-h-[720px] lg:grid-cols-[.94fr_1.06fr] lg:gap-12 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
          >
            <p className="mb-5 inline-flex rounded-full bg-white/75 px-4 py-2 text-sm font-black uppercase tracking-[.18em] text-maruxa-vino">
              Panadería artesanal en San Miguel
            </p>

            <h1 className="text-balance text-4xl font-black leading-[.96] tracking-[-.045em] text-maruxa-chocolate sm:text-6xl md:text-7xl md:leading-[.92] md:tracking-[-.06em]">
              El sabor de barrio, listo para compartir.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-maruxa-cafe/85 sm:mt-7 sm:text-xl sm:leading-8">
              Panes, pastelería y tortas Maruxa. Compra en línea y coordina
              tu retiro en nuestro local.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a className="btn-rojo inline-flex items-center justify-center gap-2" href="#catalogo">
                <ShoppingBag size={19} /> Comprar ahora
              </a>
              <a
                className="btn-crema inline-flex items-center justify-center gap-2"
                href={`https://wa.me/${whatsapp}?text=${mensaje}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={19} /> Consultar por WhatsApp
              </a>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${direccionMapa}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-3 text-sm font-black text-maruxa-chocolate shadow-sm transition hover:bg-white"
              >
                <MapPin size={18} className="text-maruxa-rojo" />
                {MARUXA.direccion}
              </a>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-3 text-sm font-black text-maruxa-cafe/80">
                <ShieldCheck size={18} className="text-maruxa-rojo" /> Retiro en local
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative"
          >
            <div className="absolute -inset-3 rounded-[46px] bg-white/35 blur-2xl" />
            <div className="relative min-h-[340px] overflow-hidden rounded-[34px] border border-maruxa-cafe/10 bg-[#fffaf2] p-5 text-maruxa-chocolate shadow-premium sm:min-h-[470px] sm:rounded-[48px] sm:p-7">
              {cargandoDestacados ? (
                <div className="relative grid min-h-[292px] place-items-center sm:min-h-[390px]">
                  <p className="font-black text-maruxa-cafe/65">Cargando producto disponible...</p>
                </div>
              ) : productoDestacado ? (
                <div className="relative">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.18em] text-maruxa-rojo">
                        Productos del catálogo
                      </p>
                      <h2 className="mt-2 text-2xl font-black text-maruxa-chocolate sm:text-3xl">
                        Disponible para pedir hoy
                      </h2>
                    </div>
                    <a href="#catalogo" className="shrink-0 text-sm font-black text-maruxa-rojo hover:underline">
                      Ver todos
                    </a>
                  </div>

                  <Link
                    key={productoDestacado.id}
                    href={productoDestacado.slug ? `/productos/${productoDestacado.slug}` : '#catalogo'}
                    className="group mt-5 grid overflow-hidden rounded-[28px] border border-maruxa-cafe/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:grid-cols-[1.15fr_.85fr]"
                  >
                    <div className="h-48 overflow-hidden bg-maruxa-crema sm:h-[300px]">
                      {productoDestacado.imagen ? (
                        <img
                          src={productoDestacado.imagen}
                          alt={productoDestacado.nombre}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-maruxa-rojo/55">
                          <ShoppingBag size={52} aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col justify-center p-5 sm:p-6">
                      <p className="text-xs font-black uppercase tracking-[.14em] text-maruxa-rojo">
                        {productoDestacado.categoria}
                      </p>
                      <h3 className="mt-3 text-2xl font-black leading-tight text-maruxa-chocolate">
                        {productoDestacado.nombre}
                      </h3>
                      <p className="mt-3 text-2xl font-black text-maruxa-rojo">
                        ${productoDestacado.precio.toLocaleString('es-CL')}
                      </p>
                      <span className="mt-5 font-black text-maruxa-chocolate group-hover:text-maruxa-rojo">
                        Ver producto
                      </span>
                    </div>
                  </Link>

                  {destacados.length > 1 && (
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-xs font-bold leading-5 text-maruxa-cafe/65">
                        {indiceDestacado + 1} de {destacados.length} productos activos
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => cambiarDestacado(-1)}
                          aria-label="Ver producto anterior"
                          className="grid h-9 w-9 place-items-center rounded-full border border-maruxa-cafe/15 bg-white text-maruxa-chocolate transition hover:border-maruxa-rojo/40 hover:text-maruxa-rojo"
                        >
                          <ChevronLeft size={19} />
                        </button>
                        <button
                          type="button"
                          onClick={() => cambiarDestacado(1)}
                          aria-label="Ver siguiente producto"
                          className="grid h-9 w-9 place-items-center rounded-full border border-maruxa-cafe/15 bg-white text-maruxa-chocolate transition hover:border-maruxa-rojo/40 hover:text-maruxa-rojo"
                        >
                          <ChevronRight size={19} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative flex min-h-[292px] flex-col justify-between sm:min-h-[390px]">
                  <img
                    src="/logo-maruxa.png"
                    alt="Panadería Maruxa"
                    className="w-40 object-contain sm:w-52"
                  />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.18em] text-maruxa-rojo">
                      Catálogo Maruxa
                    </p>
                    <h2 className="mt-3 max-w-md text-3xl font-black leading-tight text-maruxa-chocolate sm:text-4xl">
                      Revisa nuestros productos disponibles.
                    </h2>
                    <a
                      href="#catalogo"
                      className="mt-7 inline-flex items-center gap-2 rounded-full bg-maruxa-crema px-5 py-3 font-black text-maruxa-vino transition hover:-translate-y-0.5 hover:bg-white"
                    >
                      <ShoppingBag size={18} /> Ver catálogo
                    </a>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-y border-maruxa-cafe/10 bg-white/60 py-7">
        <div className="contenedor grid gap-4 text-center sm:grid-cols-3 sm:text-left">
          <div className="flex items-center justify-center gap-3 sm:justify-start">
            <Clock className="text-maruxa-rojo" size={22} />
            <span className="font-black text-maruxa-chocolate">Horneado diario</span>
          </div>
          <div className="flex items-center justify-center gap-3 sm:justify-start">
            <MapPin className="text-maruxa-rojo" size={22} />
            <span className="font-black text-maruxa-chocolate">Retiro en Av. Santa Rosa 6019</span>
          </div>
          <div className="flex items-center justify-center gap-3 sm:justify-start">
            <CakeSlice className="text-maruxa-rojo" size={22} />
            <span className="font-black text-maruxa-chocolate">Tortas con 24 h de anticipación</span>
          </div>
        </div>
      </section>

      <section className="bg-maruxa-crema py-14 sm:py-20">
        <div className="contenedor">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-black uppercase tracking-[.2em] text-maruxa-rojo">
                Elige tu favorito
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-[-.04em] text-maruxa-chocolate sm:text-5xl">
                Lo más pedido en Maruxa
              </h2>
            </div>
            <a href="#catalogo" className="font-black text-maruxa-rojo hover:underline">
              Ver todo el catálogo
            </a>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {accesosCatalogo.map((acceso) => {
              const Icono = acceso.icono;
              return (
                <Link
                  key={acceso.nombre}
                  href={acceso.href}
                  className="card-premium group rounded-[28px] p-6 transition hover:-translate-y-1 hover:border-maruxa-rojo/30"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-maruxa-rojo/10 text-maruxa-rojo">
                    <Icono size={24} />
                  </span>
                  <h3 className="mt-5 text-2xl font-black text-maruxa-chocolate">
                    {acceso.nombre}
                  </h3>
                  <p className="mt-2 leading-7 text-maruxa-cafe/75">{acceso.detalle}</p>
                  <span className="mt-5 inline-block font-black text-maruxa-rojo group-hover:underline">
                    Ver productos
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <Suspense fallback={<div className="bg-maruxa-crema py-12 text-center font-bold">Cargando catálogo...</div>}>
        <Catalogo />
      </Suspense>

      <section id="retiro" className="border-t border-maruxa-cafe/10 bg-white/45 py-14 sm:py-20">
        <div className="contenedor grid gap-5 md:grid-cols-3">
          <div className="card-premium rounded-[30px] p-7 sm:p-8">
            <MapPin className="text-maruxa-rojo" />
            <h3 className="mt-4 text-2xl font-black text-maruxa-chocolate">Retiro en local</h3>
            <p className="mt-2 leading-7 text-maruxa-cafe/75">{MARUXA.direccion}. Coordina tu pedido y ven a retirarlo.</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${direccionMapa}`}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-block font-black text-maruxa-rojo hover:underline"
            >
              Cómo llegar
            </a>
          </div>

          <div className="card-premium rounded-[30px] p-7 sm:p-8">
            <CakeSlice className="text-maruxa-rojo" />
            <h3 className="mt-4 text-2xl font-black text-maruxa-chocolate">Tortas por encargo</h3>
            <p className="mt-2 leading-7 text-maruxa-cafe/75">Elige tamaño y sabor en el catálogo. Para pedidos especiales necesitamos 24 horas.</p>
            <Link href="/?categoria=Pastelería&subfamilia=Tortas#catalogo" className="mt-5 inline-block font-black text-maruxa-rojo hover:underline">
              Ver tortas
            </Link>
          </div>

          <div id="contacto" className="card-premium scroll-mt-28 rounded-[30px] p-7 sm:p-8">
            <Phone className="text-maruxa-rojo" />
            <h3 className="mt-4 text-2xl font-black text-maruxa-chocolate">¿Necesitas ayuda?</h3>
            <p className="mt-2 leading-7 text-maruxa-cafe/75">Escríbenos para consultar disponibilidad, pedidos o retiro.</p>
            <a href={`https://wa.me/${whatsapp}?text=${mensaje}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 font-black text-maruxa-rojo hover:underline">
              <MessageCircle size={18} /> WhatsApp Maruxa
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-maruxa-cafe/10 py-8">
        <div className="contenedor flex flex-col gap-3 text-sm font-bold text-maruxa-cafe/70 sm:flex-row sm:items-center sm:justify-between">
          <p>Panadería Maruxa · San Miguel · {telefonoVisible}</p>
          <div className="flex flex-wrap items-center gap-4">
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="transition hover:text-green-700">WhatsApp</a>
            <a href={instagram} target="_blank" rel="noreferrer" className="transition hover:text-maruxa-rojo">Instagram</a>
            <a href={facebook} target="_blank" rel="noreferrer" className="transition hover:text-blue-700">Facebook</a>
            <a href="/politica-de-privacidad" className="transition hover:text-maruxa-rojo">Política de privacidad</a>
            <a href="/condiciones-del-servicio" className="transition hover:text-maruxa-rojo">Condiciones del servicio</a>
          </div>
        </div>
      </footer>

      <CartDrawer />
      <MobileCartBar />
    </>
  );
}
