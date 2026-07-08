'use client';

import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useCart } from '@/lib/cart';
import { ProductosRelacionados } from '@/components/ProductosRelacionados';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { supabasePublic } from '@/lib/supabase-public';
import { useRouter } from 'next/navigation';
import { obtenerEmpresaActual } from '@/lib/empresa';


type Producto = {
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

const tamanos = [
  { nombre: '10 personas', campo: 'precio_10' },
  { nombre: '15 personas', campo: 'precio_15' },
  { nombre: '20 personas', campo: 'precio_20' },
  { nombre: '25 personas', campo: 'precio_25' },
] as const;

export default function ProductoDetalle({ slug }: { slug: string }) {
  const [producto, setProducto] = useState<Producto | null>(null);
  type TamanoTorta = (typeof tamanos)[number];

const [tamano, setTamano] = useState<TamanoTorta>(tamanos[0]);
  const [cargando, setCargando] = useState(true);
  const router = useRouter();

  const addItem = useCart((s) => s.addItem);

  useEffect(() => {
    async function cargarProducto() {
      const empresa = await obtenerEmpresaActual();
  
      if (!empresa) {
        console.error('No se pudo identificar la empresa.');
        setCargando(false);
        return;
      }
  
      const { data } = await supabasePublic
        .from('productos')
        .select(
          `id,nombre,descripcion,precio,categoria,imagen,slug,precio_10,precio_15,precio_20,precio_25,
          familias_productos!inner (
            id
          )`
        )
        .eq('slug', slug)
        .eq('empresa_id', empresa.id)
        .eq('activo', true)
        .eq('tipo_producto', 'producto')
        .eq('familias_productos.activo', true)
        .eq('familias_productos.mostrar_catalogo', true)
        .gt('precio', 0)
        .maybeSingle();
  
      setProducto(data as Producto);
      setCargando(false);
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

  const precioFinal = esTorta
    ? producto[tamano.campo] || producto.precio
    : producto.precio;

  return (
    <main className="min-h-screen bg-maruxa-crema py-20">
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
        <motion.div className="relative h-[620px] overflow-hidden rounded-[44px] bg-white shadow-premium">
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

          <h1 className="mt-5 text-6xl font-black tracking-[-.05em] text-maruxa-chocolate">
            {producto.nombre}
          </h1>

          <p className="mt-6 text-xl leading-8 text-maruxa-cafe/80">
            {producto.descripcion}
          </p>

          {esTorta && (
            <div className="mt-10">
              <p className="mb-4 text-sm font-black uppercase tracking-widest text-maruxa-rojo">
                Elige tamaño
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {tamanos.map((t) => {
                  const activo = tamano.nombre === t.nombre;
                  const precioTamano = producto[t.campo];

                  return (
                    <button
                      key={t.nombre}
                      onClick={() => setTamano(t)}
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

          <div className="mt-10 rounded-[34px] bg-white p-6 shadow-premium">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-maruxa-cafe/60">
                  Precio
                </p>

                <p className="mt-1 text-5xl font-black text-maruxa-vino">
                  ${precioFinal.toLocaleString('es-CL')}
                </p>
              </div>

              <div className="flex flex-col gap-3">
  <button
    onClick={() => {
      addItem({
        id: producto.id,
        nombre: producto.nombre,
        precio: precioFinal,
        imagen: producto.imagen,
        tamano: esTorta
          ? tamano.nombre
          : undefined,
        cantidad: 1,
      });

      toast.success(
        `${producto.nombre} agregado al carrito`
      );
    }}
    className="btn-rojo"
  >
    Agregar al carrito
  </button>

  <div className="grid grid-cols-2 gap-3">
    <a
      href="/"
     className="rounded-full bg-[#F5E7D2] px-5 py-4 text-center text-sm font-black text-maruxa-chocolate shadow-sm"
    >
      Seguir comprando
    </a>

    <a
      href="/checkout"
      className="rounded-full bg-[#F5E7D2] px-5 py-4 text-center text-sm font-black text-maruxa-chocolate shadow-sm"
    >
      Ir al pago
    </a>
  </div>
</div>
            </div>

            <div className="mt-6 border-t border-maruxa-rojo/10 pt-6 text-sm font-bold leading-7 text-maruxa-cafe/75">
              <p>Retiro en local.</p>
              <p>Pedidos especiales con mínimo 24 horas.</p>
              <p>Confirmación final vía WhatsApp.</p>
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
    </main>
  );
}
