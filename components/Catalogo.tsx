'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Search,
} from 'lucide-react';

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
  familia?: {
    id: string;
    nombre: string;
    familia_padre_id: string | null;
    familia_principal: {
      id: string;
      nombre: string;
    } | null;
  } | null;
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
  const [subfamiliaActiva, setSubfamiliaActiva] = useState(
    searchParams.get('subfamilia') || 'Todas'
  );

  const [orden, setOrden] =
    useState('destacados');

  const [tamanoSeleccionado, setTamanoSeleccionado] =
    useState<Record<number, string>>({});

  useEffect(() => {
    const categoria = searchParams.get('categoria');
    const subfamilia = searchParams.get('subfamilia');

    if (!categoria) return;

    const productoSubfamilia = productos.find(
      (producto) =>
        producto.familia?.familia_principal &&
        producto.familia.nombre === categoria
    );

    if (productoSubfamilia?.familia?.familia_principal) {
      setCategoriaActiva(productoSubfamilia.familia.familia_principal.nombre);
      setSubfamiliaActiva(productoSubfamilia.familia.nombre);
      return;
    }

    setCategoriaActiva(categoria);
    setSubfamiliaActiva(subfamilia || 'Todas');
  }, [productos, searchParams]);

  useEffect(() => {
    async function cargarProductos() {
      const respuesta = await fetch('/api/catalogo', { cache: 'no-store' });
      const resultado = await respuesta.json();
    
      if (respuesta.ok) {
        setProductos((resultado.productos || []) as Producto[]);
      } else {
        console.error(resultado.error || 'No se pudo cargar el catalogo.');
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
    return normalizarTexto(
      `${producto.categoria} ${producto.familia?.nombre || ''}`
    ).includes('torta');
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

  function categoriaPrincipal(producto: Producto) {
    return producto.familia?.familia_principal?.nombre || producto.categoria;
  }

  function subfamiliaProducto(producto: Producto) {
    return producto.familia?.familia_principal
      ? producto.familia.nombre
      : null;
  }

  function etiquetaFamilia(producto: Producto) {
    const principal = categoriaPrincipal(producto);
    const subfamilia = subfamiliaProducto(producto);
    return subfamilia ? `${principal} › ${subfamilia}` : principal;
  }

  const categorias = [
    'Todas',
    ...new Set(
      productos.map(categoriaPrincipal)
    ),
  ];

  const subfamilias = categoriaActiva === 'Todas'
    ? []
    : [
        ...new Set(
          productos
            .filter(
              (producto) => categoriaPrincipal(producto) === categoriaActiva
            )
            .map(subfamiliaProducto)
            .filter((nombre): nombre is string => Boolean(nombre))
        ),
      ];

  const productosFiltrados = productos
    .filter((p) => {
      const texto = normalizarTexto(`
        ${p.nombre || ''}
        ${p.descripcion || ''}
        ${p.categoria || ''}
        ${etiquetaFamilia(p)}
      `);
      
      const busquedaNormalizada = normalizarTexto(busquedaDebounced);
      
      const coincideBusqueda =
        busquedaNormalizada === '' ||
        texto.includes(busquedaNormalizada);

      const coincideCategoria =
        categoriaActiva === 'Todas' ||
        categoriaPrincipal(p) === categoriaActiva;
      const coincideSubfamilia =
        subfamiliaActiva === 'Todas' ||
        subfamiliaProducto(p) === subfamiliaActiva;

      return (
        coincideBusqueda &&
        coincideCategoria &&
        coincideSubfamilia
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
                  onClick={() => {
                    setCategoriaActiva(categoria);
                    setSubfamiliaActiva('Todas');
                  }}
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

        {subfamilias.length > 0 && (
          <div className="-mt-7 mb-12 flex flex-wrap items-center gap-3 border-l-4 border-maruxa-rojo/20 pl-4">
            <span className="mr-1 text-xs font-black uppercase tracking-widest text-maruxa-cafe/55">
              Subfamilias
            </span>
            {['Todas', ...subfamilias].map((subfamilia) => {
              const activa = subfamilia === subfamiliaActiva;
              return (
                <button
                  key={subfamilia}
                  onClick={() => setSubfamiliaActiva(subfamilia)}
                  className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                    activa
                      ? 'border-maruxa-rojo bg-maruxa-rojo/10 text-maruxa-rojo'
                      : 'border-maruxa-cafe/15 bg-transparent text-maruxa-chocolate hover:border-maruxa-rojo/35'
                  }`}
                >
                  {subfamilia === 'Todas' ? `Toda ${categoriaActiva}` : subfamilia}
                </button>
              );
            })}
          </div>
        )}

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
                      {etiquetaFamilia(p)}
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
