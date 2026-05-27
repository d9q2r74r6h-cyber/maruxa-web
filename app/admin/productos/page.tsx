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
};

const CLAVE_ADMIN = 'maruxa1962';

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

  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    categoria: 'Panadería',
    imagen: '',
    destacado: false,
  });

  async function cargarProductos() {
    setCargando(true);

    const { data } = await supabase
      .from('productos')
      .select('*')
      .order('id', { ascending: false });

    setProductos((data as Producto[]) || []);
    setCargando(false);
  }

  useEffect(() => {
    if (autorizado) cargarProductos();
  }, [autorizado]);

  function entrar() {
    const claveLimpia = clave.trim();
  
    if (claveLimpia === CLAVE_ADMIN) {
      setAutorizado(true);
      return;
    }
  
    alert('Clave incorrecta');
  }

  async function crearProducto() {
    if (!form.nombre || !form.precio || !form.categoria) {
      alert('Completa nombre, precio y categoría');
      return;
    }

    const slug = crearSlug(form.nombre);

    const { error } = await supabase.from('productos').insert({
      nombre: form.nombre,
      descripcion: form.descripcion,
      precio: Number(form.precio),
      categoria: form.categoria,
      imagen: form.imagen || null,
      destacado: form.destacado,
      slug,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setForm({
      nombre: '',
      descripcion: '',
      precio: '',
      categoria: 'Panadería',
      imagen: '',
      destacado: false,
    });

    cargarProductos();
  }

  async function eliminarProducto(id: number) {
    const confirmar = confirm('¿Eliminar este producto?');

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

  async function toggleDestacado(producto: Producto) {
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

  const totalProductos = useMemo(() => productos.length, [productos]);

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
            onChange={(e) => setClave(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  entrar();
                }
              }}
            placeholder="Clave admin"
            className="mt-8 w-full rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
          />

          <button
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
            Crear producto
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) =>
                setForm({ ...form, nombre: e.target.value })
              }
              className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
            />

            <input
              placeholder="Precio"
              type="number"
              value={form.precio}
              onChange={(e) =>
                setForm({ ...form, precio: e.target.value })
              }
              className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
            />

            <select
              value={form.categoria}
              onChange={(e) =>
                setForm({ ...form, categoria: e.target.value })
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
                setForm({ ...form, imagen: e.target.value })
              }
              className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
            />

            <textarea
              placeholder="Descripción"
              value={form.descripcion}
              onChange={(e) =>
                setForm({ ...form, descripcion: e.target.value })
              }
              className="min-h-32 rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none md:col-span-2"
            />

            <label className="flex items-center gap-3 font-black text-maruxa-chocolate">
              <input
                type="checkbox"
                checked={form.destacado}
                onChange={(e) =>
                  setForm({ ...form, destacado: e.target.checked })
                }
              />
              Producto destacado
            </label>
          </div>

          <button
            onClick={crearProducto}
            className="mt-6 rounded-full bg-maruxa-rojo px-8 py-4 font-black text-white"
          >
            Crear producto
          </button>
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
              className="rounded-[28px] bg-white p-5 shadow-premium"
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
                    ${producto.precio.toLocaleString('es-CL')}
                  </p>

                  <p className="mt-1 text-sm text-maruxa-cafe/60">
                    /productos/{producto.slug}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => toggleDestacado(producto)}
                    className="rounded-full bg-maruxa-crema px-5 py-3 text-sm font-black text-maruxa-chocolate"
                  >
                    {producto.destacado ? 'Quitar destacado' : 'Destacar'}
                  </button>

                  <button
                    onClick={() => eliminarProducto(producto.id)}
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