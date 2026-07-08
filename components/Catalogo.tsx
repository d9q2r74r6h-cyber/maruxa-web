'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Search,
} from 'lucide-react';

import { supabasePublic } from '@/lib/supabase-public';
import { obtenerEmpresaActual } from '@/lib/empresa';
import { useSearchParams } from 'next/navigation';

type Producto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  categoria: string;
  imagen: string | null;
  destacado: boolean;
  slug: string | null;
  tipo_producto?: string;
  precio_10?: number | null;
  precio_15?: number | null;
  precio_20?: number | null;
  precio_25?: number | null;
};

function normalizarTexto(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}



const tamanosTorta = [
  { nombre: '10 personas', campo: 'precio_10' },
  { nombre: '15 personas', campo: 'precio_15' },
  { nombre: '20 personas', campo: 'precio_20' },
  { nombre: '25 personas', campo: 'precio_25' },
] as const;

export default function Catalogo() {

  const searchParams = useSearchParams();
  const [productos, setProductos] =
  useState<Producto[]>([]);

  const [busqueda, setBusqueda] =
    useState('');

  const [busquedaDebounced, setBusquedaDebounced] = useState('');  

  const [categoriaActiva, setCategoriaActiva] =
  useState(
    searchParams.get('categoria') || 'Todas'
  );

  const [orden, setOrden] =
    useState('destacados');

  const [tamanoSeleccionado, setTamanoSeleccionado] =
    useState<Record<number, string>>({});

    useEffect(() => {
      const categoria = searchParams.get('categoria');
    
      if (categoria) {
        setCategoriaActiva(categoria);
      }
    }, [searchParams]);   

  useEffect(() => {
    async function cargarProductos() {
      const empresa = await obtenerEmpresaActual();
    
      if (!empresa) {
        console.error('No se pudo identificar la empresa.');
        return;
      }
    
      const { data, error } = await supabasePublic
  .from('productos')
  .select(
    `id,nombre,descripcion,precio,categoria,imagen,destacado,slug,tipo_producto,precio_10,precio_15,precio_20,precio_25,
    familias_productos!inner (
      id
    )`
  )
  .eq('empresa_id', empresa.id)
  .eq('activo', true)
  .eq('tipo_producto', 'producto')
  .eq('familias_productos.activo', true)
  .eq('familias_productos.mostrar_catalogo', true)
  .gt('precio', 0)
  .order('destacado', {
    ascending: false,
  })
  .order('id', {
    ascending: true,
  });
    
      if (!error && data) {
        setProductos(data as Producto[]);
      } else {
        console.error(error);
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
    if (!esTorta(producto)) return producto.precio;
  
    const seleccionado =
      tamanoSeleccionado[producto.id] || '10 personas';
  
    if (seleccionado === '10 personas') {
      return producto.precio_10 || producto.precio;
    }
  
    if (seleccionado === '15 personas') {
      return producto.precio_15 || producto.precio;
    }
  
    if (seleccionado === '20 personas') {
      return producto.precio_20 || producto.precio;
    }
  
    if (seleccionado === '25 personas') {
      return producto.precio_25 || producto.precio;
    }
  
    return producto.precio;
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
      const texto = normalizarTexto(`
        ${p.nombre || ''}
        ${p.descripcion || ''}
        ${p.categoria || ''}
      `);
      
      const busquedaNormalizada = normalizarTexto(busquedaDebounced);
      
      const coincideBusqueda =
        busquedaNormalizada === '' ||
        texto.includes(busquedaNormalizada);

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
      const busquedaNormalizada =
        normalizarTexto(busquedaDebounced);
    
      if (busquedaNormalizada) {
        const nombreA = normalizarTexto(a.nombre || '');
        const nombreB = normalizarTexto(b.nombre || '');
    
        const aEmpieza = nombreA.startsWith(busquedaNormalizada);
        const bEmpieza = nombreB.startsWith(busquedaNormalizada);
    
        if (aEmpieza && !bEmpieza) return -1;
        if (!aEmpieza && bEmpieza) return 1;
    
        const aIncluye = nombreA.includes(busquedaNormalizada);
        const bIncluye = nombreB.includes(busquedaNormalizada);
    
        if (aIncluye && !bIncluye) return -1;
        if (!aIncluye && bIncluye) return 1;
      }
    
      if (orden === 'precio-menor') return a.precio - b.precio;
      if (orden === 'precio-mayor') return b.precio - a.precio;
      if (orden === 'nombre') return a.nombre.localeCompare(b.nombre);
    
      return Number(b.destacado) - Number(a.destacado);
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
            (p, index) => (
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
                            priority={index === 0}
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
                        {tamanosTorta.map((t) => {
                            const precio = p[t.campo] || p.precio;

                            return (
                              <option key={t.nombre} value={t.nombre}>
                                {t.nombre} - ${precio.toLocaleString('es-CL')}
                              </option>
                            );
                          })}
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
