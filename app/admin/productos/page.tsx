'use client';

import { useEffect, useMemo, useState } from 'react';
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
  precio_10: number | null;
    precio_15: number | null;
    precio_20: number | null;
    precio_25: number | null;
};

const CLAVE_ADMIN = 'maruxa1962';

const formInicial = {
  nombre: '',
  descripcion: '',
  precio: '',
  categoria: 'Panadería',
  imagen: '',
  destacado: false,
  precio_10: '',
precio_15: '',
precio_20: '',
precio_25: '',
};

function crearSlug(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function AdminProductosPage() {
  const [clave, setClave] = useState('');
  const [autorizado, setAutorizado] = useState(false);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(false);

  const [productoEditando, setProductoEditando] =
    useState<Producto | null>(null);

  const [imagenesStorage, setImagenesStorage] = useState<
    { nombre: string; url: string }[]
  >([]);

  const [form, setForm] = useState(formInicial);

  const totalProductos = useMemo(
    () => productos.length,
    [productos]
  );

  async function cargarProductos() {
    setCargando(true);

    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      alert(error.message);
      setCargando(false);
      return;
    }

    setProductos((data as Producto[]) || []);
    setCargando(false);
  }

  async function cargarImagenesStorage() {
    const carpetas = ['', 'productos', 'imagenes', 'public'];
    const todasLasImagenes: { nombre: string; url: string }[] = [];
  
    for (const carpeta of carpetas) {
      const { data, error } = await supabase.storage
        .from('productos')
        .list(carpeta, {
          limit: 100,
          sortBy: {
            column: 'name',
            order: 'asc',
          },
        });
  
      if (error) continue;
  
      data
        ?.filter((archivo) =>
          archivo.name.match(/\.(jpg|jpeg|png|webp)$/i)
        )
        .forEach((archivo) => {
          const ruta = carpeta
            ? `${carpeta}/${archivo.name}`
            : archivo.name;
  
          const { data: publicUrl } = supabase.storage
            .from('productos')
            .getPublicUrl(ruta);
  
          todasLasImagenes.push({
            nombre: archivo.name,
            url: publicUrl.publicUrl,
          });
        });
    }
  
    setImagenesStorage(todasLasImagenes);
  }

  useEffect(() => {
    if (autorizado) {
      cargarProductos();
      cargarImagenesStorage();
    }
  }, [autorizado]);

  function entrar() {
    if (clave.trim() === CLAVE_ADMIN) {
      setAutorizado(true);
      return;
    }

    alert('Clave incorrecta');
  }

  function limpiarFormulario() {
    setProductoEditando(null);
    setForm(formInicial);
  }

  function editarProducto(producto: Producto) {
    setProductoEditando(producto);

    setForm({
        nombre: producto.nombre,
        descripcion: producto.descripcion || '',
        precio: String(producto.precio || ''),
        categoria: producto.categoria,
        imagen: producto.imagen || '',
        destacado: producto.destacado,
        precio_10: String(producto.precio_10 || ''),
        precio_15: String(producto.precio_15 || ''),
        precio_20: String(producto.precio_20 || ''),
        precio_25: String(producto.precio_25 || ''),
      });

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function crearProducto() {
    if (!form.nombre || !form.precio || !form.categoria) {
      alert('Completa nombre, precio y categoría');
      return;
    }

    const { error } = await supabase
      .from('productos')
      .insert({
        nombre: form.nombre,
        descripcion: form.descripcion,
        precio: Number(form.precio),
        categoria: form.categoria,
        imagen: form.imagen || null,
        destacado: form.destacado,
        slug: crearSlug(form.nombre),
        precio_10: form.precio_10 ? Number(form.precio_10) : null,
precio_15: form.precio_15 ? Number(form.precio_15) : null,
precio_20: form.precio_20 ? Number(form.precio_20) : null,
precio_25: form.precio_25 ? Number(form.precio_25) : null,
      });

    if (error) {
      alert(error.message);
      return;
    }

    limpiarFormulario();
    cargarProductos();
  }

  async function guardarCambios() {
    if (!productoEditando) return;

    const { error } = await supabase
      .from('productos')
      .update({
        nombre: form.nombre,
        descripcion: form.descripcion,
        precio: Number(form.precio),
        categoria: form.categoria,
        imagen: form.imagen || null,
        destacado: form.destacado,
        slug: crearSlug(form.nombre),
        precio_10: form.precio_10 ? Number(form.precio_10) : null,
precio_15: form.precio_15 ? Number(form.precio_15) : null,
precio_20: form.precio_20 ? Number(form.precio_20) : null,
precio_25: form.precio_25 ? Number(form.precio_25) : null,
      })
      .eq('id', productoEditando.id);

    if (error) {
      alert(error.message);
      return;
    }

    limpiarFormulario();
    cargarProductos();
  }

  async function eliminarProducto(id: number) {
    const confirmar = confirm(
      '¿Eliminar este producto?'
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) {
      alert(error.message);
      return;
    }

    cargarProductos();
  }

  async function toggleDestacado(
    producto: Producto
  ) {
    const { error } = await supabase
      .from('productos')
      .update({
        destacado: !producto.destacado,
      })
      .eq('id', producto.id);

    if (error) {
      alert(error.message);
      return;
    }

    cargarProductos();
  }

  if (!autorizado) {
    return (
      <main className="min-h-screen bg-maruxa-crema px-5 py-20">
        <div className="mx-auto max-w-md rounded-[34px] bg-white p-8 shadow-premium">
          <h1 className="text-4xl font-black text-maruxa-chocolate">
            Admin Maruxa
          </h1>

          <p className="mt-3 text-maruxa-cafe/70">
            Ingresa la clave para administrar productos.
          </p>

          <input
            type="password"
            value={clave}
            onChange={(e) =>
              setClave(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                entrar();
              }
            }}
            placeholder="Clave admin"
            className="mt-8 w-full rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
          />

          <button
            type="button"
            onClick={entrar}
            className="mt-5 w-full rounded-full bg-maruxa-rojo px-5 py-4 font-black text-white"
          >
            Entrar
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-maruxa-crema px-5 py-12">
      <div className="mx-auto max-w-6xl">

        <div className="mb-10">
          <p className="font-black uppercase tracking-[.24em] text-maruxa-rojo">
            Panel privado
          </p>

          <h1 className="mt-3 text-5xl font-black text-maruxa-chocolate">
            Productos Maruxa
          </h1>

          <p className="mt-3 font-bold text-maruxa-cafe/70">
            {totalProductos} productos registrados
          </p>
        </div>

        <section className="mb-10 rounded-[34px] bg-white p-6 shadow-premium">

          <h2 className="text-2xl font-black text-maruxa-chocolate">
            {productoEditando
              ? 'Editar producto'
              : 'Crear producto'}
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">

            <input
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) =>
                setForm({
                  ...form,
                  nombre: e.target.value,
                })
              }
              className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
            />

            <input
              placeholder="Precio"
              type="number"
              value={form.precio}
              onChange={(e) =>
                setForm({
                  ...form,
                  precio: e.target.value,
                })
              }
              className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
            />

{form.categoria === 'Tortas' && (
  <>
    <input
      placeholder="Precio 10 personas"
      type="number"
      value={form.precio_10}
      onChange={(e) =>
        setForm({
          ...form,
          precio_10: e.target.value,
        })
      }
      className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
    />

    <input
      placeholder="Precio 15 personas"
      type="number"
      value={form.precio_15}
      onChange={(e) =>
        setForm({
          ...form,
          precio_15: e.target.value,
        })
      }
      className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
    />

    <input
      placeholder="Precio 20 personas"
      type="number"
      value={form.precio_20}
      onChange={(e) =>
        setForm({
          ...form,
          precio_20: e.target.value,
        })
      }
      className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
    />

    <input
      placeholder="Precio 25 personas"
      type="number"
      value={form.precio_25}
      onChange={(e) =>
        setForm({
          ...form,
          precio_25: e.target.value,
        })
      }
      className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
    />
  </>
)}

            <select
              value={form.categoria}
              onChange={(e) =>
                setForm({
                  ...form,
                  categoria: e.target.value,
                })
              }
              className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
            >
              <option>Panadería</option>
              <option>Pastelería</option>
              <option>Tortas</option>
              <option>Empanadas</option>
              <option>Especiales</option>
            </select>

            <input
              placeholder="URL imagen"
              value={form.imagen}
              onChange={(e) =>
                setForm({
                  ...form,
                  imagen: e.target.value,
                })
              }
              className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
            />

            <textarea
              placeholder="Descripción"
              value={form.descripcion}
              onChange={(e) =>
                setForm({
                  ...form,
                  descripcion: e.target.value,
                })
              }
              className="min-h-32 rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none md:col-span-2"
            />

            <label className="flex items-center gap-3 font-black text-maruxa-chocolate">
              <input
                type="checkbox"
                checked={form.destacado}
                onChange={(e) =>
                  setForm({
                    ...form,
                    destacado: e.target.checked,
                  })
                }
              />

              Producto destacado
            </label>
            <div className="mt-6 flex flex-wrap gap-3">
  <button
    type="button"
    onClick={
      productoEditando
        ? guardarCambios
        : crearProducto
    }
    className="rounded-full bg-maruxa-rojo px-8 py-4 font-black text-white"
  >
    {productoEditando
      ? 'Guardar cambios'
      : 'Guardar producto'}
  </button>

  <button
    type="button"
    onClick={limpiarFormulario}
    className="rounded-full bg-maruxa-crema px-8 py-4 font-black text-maruxa-chocolate"
  >
    Limpiar formulario
  </button>
</div>
          </div>

          
        </section>

        <section className="mb-10 rounded-[34px] bg-white p-6 shadow-premium">

          <h2 className="text-2xl font-black text-maruxa-chocolate">
            Imágenes del Storage
          </h2>

          <p className="mt-2 text-sm font-bold text-maruxa-cafe/70">
          Imágenes cargadas: {imagenesStorage.length}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">

            {imagenesStorage.map((imagen) => {
              const nombreLimpio =
                imagen.nombre
                  .replace(/\.[^/.]+$/, '')
                  .replace(/[-_]/g, ' ');

              return (
                <button
                  key={imagen.url}
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      nombre: nombreLimpio,
                      imagen: imagen.url,
                    })
                  }
                  className="overflow-hidden rounded-[24px] bg-maruxa-crema text-left shadow-premium transition hover:-translate-y-1"
                >
                  <img
                    src={imagen.url}
                    alt={imagen.nombre}
                    className="h-40 w-full object-cover"
                  />

                  <div className="p-3">
                    <p className="line-clamp-2 text-xs font-black text-maruxa-chocolate">
                      {imagen.nombre}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4">

          {cargando && (
            <div className="rounded-[28px] bg-white p-6 font-black shadow-premium">
              Cargando productos...
            </div>
          )}

          {productos.map((producto) => (
            <article
              key={producto.id}
              onClick={() =>
                editarProducto(producto)
              }
              className="cursor-pointer rounded-[28px] bg-white p-5 shadow-premium transition hover:-translate-y-1 hover:ring-2 hover:ring-maruxa-rojo/20"
            >
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">

                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-maruxa-rojo">
                    {producto.categoria}
                  </p>

                  <h3 className="mt-2 text-2xl font-black text-maruxa-chocolate">
                    {producto.nombre}
                  </h3>

                  <p className="mt-1 font-bold text-maruxa-cafe/70">
                    $
                    {producto.precio.toLocaleString(
                      'es-CL'
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDestacado(producto);
                    }}
                    className="rounded-full bg-maruxa-crema px-5 py-3 text-sm font-black text-maruxa-chocolate"
                  >
                    {producto.destacado
                      ? 'Quitar destacado'
                      : 'Destacar'}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      eliminarProducto(producto.id);
                    }}
                    className="rounded-full bg-red-600 px-5 py-3 text-sm font-black text-white"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}