'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabasePublic } from '@/lib/supabase-public';

type Producto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  categoria: string;
  imagen: string | null;
  slug: string | null;
};

export function ProductosRelacionados({
  categoria,
  productoActualId,
}: {
  categoria: string;
  productoActualId: number;
}) {
  const [productos, setProductos] = useState<Producto[]>([]);

  useEffect(() => {
    async function cargar() {
      const { data } = await supabasePublic
        .from('productos')
        .select('id,nombre,descripcion,precio,categoria,imagen,slug')
        .eq('activo', true)
        .eq('tipo_producto', 'producto')
        .eq('categoria', categoria)
        .neq('id', productoActualId)
        .limit(3);

      setProductos((data || []) as Producto[]);
    }

    cargar();
  }, [categoria, productoActualId]);

  if (productos.length === 0) return null;

  return (
    <section className="mt-20">
      <h2 className="mb-6 text-3xl font-black tracking-[-.04em] text-maruxa-chocolate md:text-5xl">
        También podría gustarte
      </h2>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {productos.map((p) => (
          <Link
            key={p.id}
            href={`/productos/${p.slug}`}
            className="card-premium rounded-[28px] p-4 transition hover:-translate-y-1"
          >
            <div className="relative h-52 overflow-hidden rounded-[22px] bg-white">
              {p.imagen ? (
                <Image
                  src={p.imagen}
                  alt={p.nombre}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center text-7xl">
                  🥐
                </div>
              )}
            </div>

            <div className="p-3">
              <p className="text-xs font-black uppercase tracking-widest text-maruxa-rojo">
                {p.categoria}
              </p>

              <h3 className="mt-2 text-xl font-black text-maruxa-chocolate">
                {p.nombre}
              </h3>

              <p className="mt-2 text-lg font-black text-maruxa-vino">
                ${p.precio.toLocaleString('es-CL')}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
