'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Search,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';

type Producto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  categoria: string;
  imagen: string | null;
  destacado: boolean;
  slug: string | null;
};

const productosFallback: Producto[] = [
  {
    id: 1,
    nombre: 'Pan amasado',
    descripcion:
      'Pan tradicional de la casa, horneado todos los días.',
    precio: 1200,
    categoria: 'Panadería',
    imagen: null,
    destacado: true,
    slug: 'pan-amasado',
  },
  {
    id: 2,
    nombre: 'Hallulla',
    descripcion:
      'Clásica hallulla chilena, suave y dorada.',
    precio: 900,
    categoria: 'Panadería',
    imagen: null,
    destacado: true,
    slug: 'hallulla',
  },
  {
    id: 3,
    nombre: 'Torta milhojas',
    descripcion:
      'Torta artesanal con manjar y capas crujientes.',
    precio: 18900,
    categoria: 'Tortas',
    imagen:
      'https://kpbmcwtpkavtezwmltnn.supabase.co/storage/v1/object/public/productos/18-Pastel-Pina-2.jpg',
    destacado: true,
    slug: 'torta-milhojas',
  },
  {
    id: 4,
    nombre: 'Kuchen de manzana',
    descripcion:
      'Kuchen casero con manzana y masa suave.',
    precio: 14900,
    categoria: 'Pastelería',
    imagen: null,
    destacado: false,
    slug: 'kuchen-manzana',
  },
];

const tamanosTorta = [
  { nombre: '10 personas', extra: 0 },
  { nombre: '15 personas', extra: 6000 },
  { nombre: '20 personas', extra: 12000 },
  { nombre: '25 personas', extra: 18000 },
];

export default function Catalogo() {
  const [productos, setProductos] =
    useState<Producto[]>(productosFallback);

  const [busqueda, setBusqueda] =
    useState('');

  const [busquedaDebounced, setBusquedaDebounced] = useState('');  

  const [categoriaActiva, setCategoriaActiva] =
    useState('Todas');

  const [orden, setOrden] =
    useState('destacados');

  const [tamanoSeleccionado, setTamanoSeleccionado] =
    useState<Record<number, string>>({});

  useEffect(() => {
    async function cargarProductos() {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('destacado', {
          ascending: false,
        })
        .order('id', {
          ascending: true,
        });

      if (!error && data && data.length > 0) {
        setProductos(data as Producto[]);
      }
    }

    cargarProductos();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaDebounced(busqueda);
    }, 250);
  
    return () => clearTimeout(timer);
  }, [busqueda]);

  function esTorta(producto: Producto) {
    return producto.categoria
      .toLowerCase()
      .includes('torta');
  }

  function precioConTamano(producto: Producto) {
    if (!esTorta(producto))
      return producto.precio;

    const seleccionado =
      tamanoSeleccionado[producto.id] ||
      '10 personas';

    const tamano =
      tamanosTorta.find(
        (t) =>
          t.nombre === seleccionado
      );

    return (
      producto.precio +
      (tamano?.extra || 0)
    );
  }

  function slugProducto(producto: Producto) {
    return (
      producto.slug ||
      producto.nombre
        .toLowerCase()
        .replaceAll(' ', '-')
    );
  }

  const categorias = [
    'Todas',
    ...new Set(
      productos.map(
        (p) => p.categoria
      )
    ),
  ];

  const productosFiltrados = productos
    .filter((p) => {
      const texto = `
        ${p.nombre}
        ${p.descripcion}
        ${p.categoria}
      `.toLowerCase();

      const coincideBusqueda =
        texto.includes(
          busqueda.toLowerCase()
        );

      const coincideCategoria =
        categoriaActiva === 'Todas' ||
        p.categoria ===
          categoriaActiva;

      return (
        coincideBusqueda &&
        coincideCategoria
      );
    })
    .sort((a, b) => {
      if (orden === 'precio-menor')
        return a.precio - b.precio;

      if (orden === 'precio-mayor')
        return b.precio - a.precio;

      if (orden === 'nombre')
        return a.nombre.localeCompare(
          b.nombre
        );

      return (
        Number(b.destacado) -
        Number(a.destacado)
      );
    });

  return (
    <section
      id="catalogo"
      className="bg-maruxa-crema py-24"
    >
      <div className="contenedor">

        <div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">

          <div>
            <p className="font-black uppercase tracking-[.24em] text-maruxa-rojo">
              Catálogo Maruxa
            </p>

            <h2 className="mt-3 text-5xl font-black tracking-[-.04em] text-maruxa-chocolate">
              Favoritos del horno
            </h2>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-maruxa-cafe/75">
              Panes, pastelería y tortas
              con opciones de tamaño
              para pedidos especiales.
            </p>
          </div>
        </div>

        <div className="mb-10">
          <div className="relative max-w-xl">

            <Search
              size={20}
              className="absolute left-5 top-1/2 -translate-y-1/2 text-maruxa-cafe/40"
            />

            <input
              type="text"
              placeholder="Buscar productos..."
              value={busqueda}
              onChange={(e) =>
                setBusqueda(
                  e.target.value
                )
              }
              className="w-full rounded-[24px] border border-maruxa-rojo/10 bg-white py-4 pl-14 pr-5 text-lg font-semibold text-maruxa-chocolate shadow-premium outline-none transition focus:border-maruxa-rojo/40"
            />
          </div>
        </div>

        <div className="mb-12 flex flex-wrap gap-3">

          {categorias.map(
            (categoria) => {
              const activa =
                categoria ===
                categoriaActiva;

              return (
                <button
                  key={categoria}
                  onClick={() =>
                    setCategoriaActiva(
                      categoria
                    )
                  }
                  className={`rounded-full px-5 py-3 text-sm font-black transition ${
                    activa
                      ? 'bg-maruxa-rojo text-maruxa-crema'
                      : 'bg-white text-maruxa-chocolate hover:bg-maruxa-rojo/10'
                  }`}
                >
                  {categoria}
                </button>
              );
            }
          )}
        </div>

        <div className="mb-10 max-w-xs">
          <select
            value={orden}
            onChange={(e) =>
              setOrden(
                e.target.value
              )
            }
            className="w-full rounded-[20px] border border-maruxa-rojo/10 bg-white px-5 py-4 font-black text-maruxa-chocolate shadow-premium outline-none"
          >
            <option value="destacados">
              Ordenar: destacados
            </option>

            <option value="precio-menor">
              Precio: menor a mayor
            </option>

            <option value="precio-mayor">
              Precio: mayor a menor
            </option>

            <option value="nombre">
              Nombre A-Z
            </option>
          </select>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

          {productosFiltrados.length === 0 && (
            <div className="col-span-full rounded-[34px] bg-white p-10 text-center shadow-premium">

              <p className="text-3xl font-black text-maruxa-chocolate">
                No encontramos productos
              </p>

              <p className="mt-3 text-maruxa-cafe/70">
                Intenta buscar otro
                nombre o categoría.
              </p>
            </div>
          )}

          {productosFiltrados.map(
            (p) => (
              <motion.article
                key={p.id}
                initial={{
                  opacity: 0,
                  y: 18,
                }}
                whileInView={{
                  opacity: 1,
                  y: 0,
                }}
                viewport={{
                  once: true,
                  margin: '-60px',
                }}
                transition={{
                  duration: 0.45,
                }}
                whileHover={{
                  y: -6,
                }}
                className="card-premium group rounded-[34px] p-5 transition"
              >
                <Link
                  href={`/productos/${slugProducto(
                    p
                  )}`}
                >
                  <div className="relative h-56 overflow-hidden rounded-[28px]">

                    {p.imagen ? (
                      <Image
                        src={p.imagen}
                        alt={p.nombre}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full place-items-center bg-gradient-to-br from-white to-maruxa-masa text-8xl">
                        🥐
                      </div>
                    )}
                  </div>
                </Link>

                <div className="p-4">

                  <div className="mb-3 flex items-center justify-between">

                    <span className="rounded-full bg-maruxa-rojo/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-maruxa-rojo">
                      {p.categoria}
                    </span>

                    <Link
                      href={`/productos/${slugProducto(
                        p
                      )}`}
                    >
                      <ArrowUpRight className="opacity-40 group-hover:opacity-100" />
                    </Link>
                  </div>

                  <Link
                    href={`/productos/${slugProducto(
                      p
                    )}`}
                  >
                    <h3 className="text-2xl font-black text-maruxa-chocolate">
                      {p.nombre}
                    </h3>
                  </Link>

                  <p className="mt-2 min-h-12 text-sm font-semibold leading-6 text-maruxa-cafe/75">
                    {p.descripcion}
                  </p>

                  {esTorta(p) && (
                    <div className="mt-5">

                      <p className="mb-2 text-xs font-black uppercase tracking-widest text-maruxa-rojo">
                        Tamaño
                      </p>

                      <select
                        value={
                          tamanoSeleccionado[
                            p.id
                          ] ||
                          '10 personas'
                        }
                        onChange={(
                          e
                        ) =>
                          setTamanoSeleccionado(
                            {
                              ...tamanoSeleccionado,
                              [p.id]:
                                e.target
                                  .value,
                            }
                          )
                        }
                        className="w-full rounded-2xl border border-maruxa-rojo/10 bg-white px-4 py-3 font-bold text-maruxa-chocolate outline-none"
                      >
                        {tamanosTorta.map(
                          (t) => (
                            <option
                              key={
                                t.nombre
                              }
                              value={
                                t.nombre
                              }
                            >
                              {t.nombre}

                              {t.extra >
                              0
                                ? ` (+$${t.extra.toLocaleString(
                                    'es-CL'
                                  )})`
                                : ''}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  )}

                  <div className="mt-5 flex items-center justify-between border-t border-maruxa-rojo/10 pt-5">

                    <p className="text-xl font-black text-maruxa-vino">
                      $
                      {precioConTamano(
                        p
                      ).toLocaleString(
                        'es-CL'
                      )}
                    </p>

                    <Link
                      href={`/productos/${slugProducto(
                        p
                      )}`}
                      className="rounded-full bg-maruxa-rojo px-4 py-2 text-sm font-black text-maruxa-crema"
                    >
                      Ver producto
                    </Link>
                  </div>
                </div>
              </motion.article>
            )
          )}
        </div>
      </div>
    </section>
  );
}