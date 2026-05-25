'use client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useCart } from '@/lib/cart';
import { ProductosRelacionados } from '@/components/ProductosRelacionados';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Producto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  categoria: string;
  imagen: string | null;
  slug: string | null;
};

const tamanos = [
  { nombre: '10 personas', extra: 0 },
  { nombre: '15 personas', extra: 6000 },
  { nombre: '20 personas', extra: 12000 },
  { nombre: '25 personas', extra: 18000 },
];

export default function ProductoDetalle({ slug }: { slug: string }) {
  const [producto, setProducto] = useState<Producto | null>(null);
  const [tamano, setTamano] = useState(tamanos[0]);
  const [cargando, setCargando] = useState(true);
  const addItem = useCart((s) => s.addItem);

  useEffect(() => {
    async function cargarProducto() {
      const { data } = await supabase
        .from('productos')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      setProducto(data as Producto);
      setCargando(false);
    }

    cargarProducto();
  }, [slug]);

  if (cargando) {
    return (
      <main className="min-h-screen bg-maruxa-crema py-20">
        <div className="contenedor font-black">Cargando producto...</div>
      </main>
    );
  }

  if (!producto) {
    return (
      <main className="min-h-screen bg-maruxa-crema py-20">
        <div className="contenedor">
          <h1 className="text-4xl font-black">Producto no encontrado</h1>
        </div>
      </main>
    );
  }

  const esTorta = producto.categoria.toLowerCase().includes('torta');
  const precioFinal = producto.precio + (esTorta ? tamano.extra : 0);

  const mensaje = encodeURIComponent(
    `Hola Maruxa, quiero pedir ${producto.nombre}` +
      `${esTorta ? ` tamaño ${tamano.nombre}` : ''}.`
  );

  return (
    <main className="min-h-screen bg-maruxa-crema py-20">
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
            <div className="grid h-full place-items-center text-9xl">🥐</div>
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
                      <p className="text-xl font-black">{t.nombre}</p>
                      <p className="mt-1 text-sm font-bold opacity-80">
                        {t.extra > 0
                          ? `+$${t.extra.toLocaleString('es-CL')}`
                          : 'Precio base'}
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
    'Producto agregado al carrito'
  );
}}
  className="btn-rojo"
>
  Agregar al carrito
</button>
            </div>

            <div className="mt-6 border-t border-maruxa-rojo/10 pt-6 text-sm font-bold leading-7 text-maruxa-cafe/75">
              <p>Retiro en local.</p>
              <p>Pedidos especiales con mínimo 24 horas.</p>
              <p>Confirmación final vía WhatsApp.</p>
            </div>
          </div>
        </motion.div>
      </div>
      <div className="contenedor">
  <ProductosRelacionados
    categoria={producto.categoria}
    productoActualId={producto.id}
  />
</div>
    </main>
  );
}