'use client';

import { presentacionesProducto, presentacionesDisponibles, type Presentacion } from '@/lib/presentaciones';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useCart } from '@/lib/cart';
import { ProductosRelacionados } from '@/components/ProductosRelacionados';
import { CartDrawer } from '@/components/CartDrawer';
import { MobileCartBar } from '@/components/MobileCartBar';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { CalendarDays, MapPin, MessageCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';


type Producto = {
  presentaciones?: Presentacion[] | null;
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  categoria: string;
  imagen: string | null;
  slug: string | null;
  precio_10: number | null;
  precio_15: number | null;
  precio_20: number | null;
  precio_25: number | null;
};

export default function ProductoDetalle({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const [producto, setProducto] = useState<Producto | null>(null);
  const [presentacionId, setPresentacionId] = useState('');
  const [cargando, setCargando] = useState(true);

  const addItem = useCart((s) => s.addItem);
  const presentacionSolicitada = searchParams.get('presentacion') || '';

  useEffect(() => {
    setPresentacionId(presentacionSolicitada);
  }, [presentacionSolicitada, slug]);

  useEffect(() => {
    async function cargarProducto() {
      try {
        const respuesta = await fetch(`/api/catalogo?slug=${encodeURIComponent(slug)}`, {
          cache: 'no-store',
        });
        const resultado = await respuesta.json();

        setProducto((resultado.producto || null) as Producto | null);
      } catch {
        setProducto(null);
      } finally {
        setCargando(false);
      }
    }

    cargarProducto();
  }, [slug]);

  if (cargando) {
    return (
      <main className="min-h-screen bg-maruxa-crema py-20">
        <div className="contenedor font-black">
          Cargando producto...
        </div>
      </main>
    );
  }

  if (!producto) {
    return (
      <main className="min-h-screen bg-maruxa-crema py-20">
        <div className="contenedor">
          <h1 className="text-4xl font-black">
            Producto no encontrado
          </h1>
        </div>
      </main>
    );
  }

  const esTorta = producto.categoria
    .toLowerCase()
    .includes('torta');

  const opciones = presentacionesDisponibles(producto);
  const tamano = opciones.find((p) => p.id === presentacionId) || opciones[0];
  const sinDisponibilidad = presentacionesProducto(producto).length > 0 && !tamano;
  const precioFinal = tamano?.precio ?? producto.precio;

  return (
    <main className="min-h-screen bg-maruxa-crema pb-32 pt-20">
      <div className="contenedor mb-8 text-sm font-bold text-maruxa-cafe/70">
        <a href="/" className="hover:text-maruxa-rojo">
          Inicio
        </a>

        <span className="mx-2">/</span>

        <a href="/#catalogo" className="hover:text-maruxa-rojo">
          Productos
        </a>

        <span className="mx-2">/</span>

        <span className="text-maruxa-rojo">
          {producto.nombre}
        </span>
      </div>

      <div className="contenedor grid gap-10 lg:grid-cols-2">
        <motion.div className="relative h-[340px] overflow-hidden rounded-[32px] bg-white shadow-premium sm:h-[500px] sm:rounded-[44px] lg:h-[620px]">
          {producto.imagen ? (
            <Image
              src={producto.imagen}
              alt={producto.nombre}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          ) : (
            <div className="grid h-full place-items-center text-9xl">
              🥐
            </div>
          )}
        </motion.div>

        <motion.div className="flex flex-col justify-center">
          <span className="w-fit rounded-full bg-maruxa-rojo/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-maruxa-rojo">
            {producto.categoria}
          </span>

          <h1 className="mt-5 text-4xl font-black leading-[.98] tracking-[-.05em] text-maruxa-chocolate sm:text-5xl xl:text-6xl">
            {producto.nombre}
          </h1>

          <p className="mt-5 text-lg leading-8 text-maruxa-cafe/80 sm:mt-6 sm:text-xl">
            {producto.descripcion}
          </p>

          {opciones.length > 0 && (
            <div className="mt-10">
              <p className="mb-4 text-sm font-black uppercase tracking-widest text-maruxa-rojo">
                Elige presentación
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {opciones.map((t) => {
                  const activo = tamano?.id === t.id;
                  const precioTamano = t.precio;

                  return (
                    <button
                      key={t.id}
                      onClick={() => setPresentacionId(t.id)}
                      className={`rounded-[24px] border p-5 text-left transition ${
                        activo
                          ? 'border-maruxa-rojo bg-maruxa-rojo text-maruxa-crema shadow-premium'
                          : 'border-maruxa-rojo/10 bg-white text-maruxa-chocolate hover:border-maruxa-rojo/40'
                      }`}
                    >
                      <p className="text-xl font-black">
                        {t.nombre}
                      </p>

                      <p className="mt-1 text-sm font-bold opacity-80">
                        {precioTamano
                          ? `$${precioTamano.toLocaleString('es-CL')}`
                          : 'Sin precio'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-8 rounded-[34px] bg-white p-5 shadow-premium sm:mt-10 sm:p-6">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center sm:gap-6">
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-maruxa-cafe/60">
                  {tamano ? `Precio · ${tamano.nombre}` : 'Precio'}
                </p>

                <p className="mt-1 text-4xl font-black text-maruxa-vino sm:text-5xl">
                  ${precioFinal.toLocaleString('es-CL')}
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[260px]">
                <button
                  onClick={() => {
                    if (sinDisponibilidad) return;
                    addItem({
                      id: producto.id,
                      nombre: producto.nombre,
                      precio: precioFinal,
                      imagen: producto.imagen,
                      tamano: tamano?.nombre,
                      presentacion_id: tamano?.id,
                      requiere_anticipacion: esTorta,
                      cantidad: 1,
                    });

                    toast.success(`${producto.nombre} agregado al carrito`);
                  }}
                  disabled={sinDisponibilidad}
                  className="btn-rojo w-full disabled:opacity-50"
                >
                  {sinDisponibilidad ? 'Sin presentaciones disponibles' : 'Agregar al carrito'}
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <a
                    href="/"
                    className="rounded-full bg-[#F5E7D2] px-4 py-3 text-center text-sm font-black text-maruxa-chocolate shadow-sm"
                  >
                    Seguir viendo
                  </a>

                  <a
                    href="/checkout"
                    className="rounded-full bg-[#F5E7D2] px-4 py-3 text-center text-sm font-black text-maruxa-chocolate shadow-sm"
                  >
                    Ir al pedido
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 border-t border-maruxa-rojo/10 pt-5 text-sm font-bold leading-6 text-maruxa-cafe/75 sm:grid-cols-2">
              <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-maruxa-rojo" />Retiro en Avenida Santa Rosa 6019, San Miguel.</p>
              <p className="flex items-start gap-2"><MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-maruxa-rojo" />Confirmamos tu pedido por WhatsApp.</p>
              {esTorta && (
                <p className="flex items-start gap-2 sm:col-span-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-maruxa-rojo" />Esta torta se solicita con un mínimo de 24 horas.</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: producto.nombre,
            description: producto.descripcion,
            image: producto.imagen,
            category: producto.categoria,
            brand: {
              '@type': 'Brand',
              name: 'Panadería Maruxa',
            },
            offers: {
              '@type': 'Offer',
              price: precioFinal,
              priceCurrency: 'CLP',
              availability: 'https://schema.org/InStock',
              url: `https://panaderiamaruxa.cl/productos/${producto.slug}`,
            },
          }),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Inicio',
                item: 'https://panaderiamaruxa.cl',
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Productos',
                item: 'https://panaderiamaruxa.cl/#catalogo',
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: producto.nombre,
                item: `https://panaderiamaruxa.cl/productos/${producto.slug}`,
              },
            ],
          }),
        }}
      />

      <div className="contenedor">
        <ProductosRelacionados
          categoria={producto.categoria}
          productoActualId={producto.id}
        />
      </div>

      <CartDrawer />
      <MobileCartBar />
    </main>
  );
}
