'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Printer, Search } from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';
import { supabase } from '@/lib/supabase';

type ProductoProveedor = {
  id: number;
  nombre: string;
  precio: number | null;
  proveedor_id: string | null;
  unidad_base: string | null;
};

type Proveedor = {
  id: string;
  razon_social: string;
  nombre_fantasia: string | null;
};

function dinero(valor: number | null | undefined) {
  return `$${Math.round(Number(valor || 0)).toLocaleString('es-CL')}`;
}

function normalizar(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function nombreProveedor(proveedor: Proveedor | undefined) {
  return (
    proveedor?.nombre_fantasia?.trim() ||
    proveedor?.razon_social ||
    'SIN PROVEEDOR'
  );
}

export default function ProductosPorProveedorPage() {
  const { perfil } = useAdminSession();
  const [productos, setProductos] = useState<ProductoProveedor[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productosPropiosIds, setProductosPropiosIds] = useState<Set<number>>(
    new Set()
  );
  const [productosConCambio, setProductosConCambio] = useState<
    Record<number, boolean>
  >({});
  const [proveedorId, setProveedorId] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [mostrarCuarto, setMostrarCuarto] = useState(true);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      if (!perfil) return;
      setCargando(true);

      const [
        { data: productosData, error },
        { data: proveedoresData },
        { data: recetasData, error: errorRecetas },
      ] =
        await Promise.all([
          supabase
            .from('productos')
            .select('id,nombre,precio,proveedor_id,unidad_base')
            .eq('empresa_id', perfil.empresa_id)
            .eq('activo', true)
            .eq('tipo_producto', 'producto')
            .order('nombre', { ascending: true }),
          supabase
            .from('proveedores')
            .select('id,razon_social,nombre_fantasia')
            .eq('empresa_id', perfil.empresa_id)
            .eq('activo', true)
            .order('nombre_fantasia', { ascending: true }),
          supabase
            .from('recetas')
            .select('producto_id')
            .eq('empresa_id', perfil.empresa_id)
            .not('producto_id', 'is', null),
        ]);

      if (error || errorRecetas) {
        alert(error?.message || errorRecetas?.message);
        setProductos([]);
        setProveedores([]);
        setProductosPropiosIds(new Set());
        setCargando(false);
        return;
      }

      const productosConPrecio = ((productosData as ProductoProveedor[]) || [])
        .filter((producto) => Number(producto.precio || 0) > 0);
      const ids = productosConPrecio.map((producto) => producto.id);
      const cambios: Record<number, boolean> = {};

      if (ids.length > 0) {
        const { data: historial } = await supabase
          .from('producto_costos_historial')
          .select('producto_id,precio_venta,created_at')
          .eq('empresa_id', perfil.empresa_id)
          .in('producto_id', ids)
          .not('precio_venta', 'is', null)
          .order('created_at', { ascending: false })
          .limit(Math.min(1000, Math.max(100, ids.length * 4)));
        const preciosPorProducto = new Map<number, number[]>();

        for (const registro of historial || []) {
          const id = Number(registro.producto_id);
          const precios = preciosPorProducto.get(id) || [];
          if (precios.length >= 2) continue;
          precios.push(Math.round(Number(registro.precio_venta || 0)));
          preciosPorProducto.set(id, precios);
        }

        productosConPrecio.forEach((producto) => {
          const precios = preciosPorProducto.get(producto.id) || [];
          const vigente = Math.round(Number(producto.precio || 0));
          const ultimo = precios[0] || 0;
          const anterior = precios[1] || 0;
          cambios[producto.id] =
            (ultimo > 0 && vigente !== ultimo) ||
            (anterior > 0 && ultimo !== anterior);
        });
      }

      setProductos(productosConPrecio);
      setProveedores((proveedoresData as Proveedor[]) || []);
      setProductosPropiosIds(
        new Set(
          (recetasData || [])
            .map((receta) => Number(receta.producto_id))
            .filter(Boolean)
        )
      );
      setProductosConCambio(cambios);
      setCargando(false);
    }

    void cargar();
  }, [perfil]);

  const productosFiltrados = useMemo(() => {
    const termino = normalizar(busqueda.trim());

    return productos.filter((producto) => {
      const esPropio = productosPropiosIds.has(producto.id);

      if (proveedorId === 'productos-propios' && !esPropio) return false;
      if (
        proveedorId === 'sin-proveedor' &&
        (esPropio || producto.proveedor_id)
      ) {
        return false;
      }
      if (
        proveedorId !== 'todos' &&
        proveedorId !== 'productos-propios' &&
        proveedorId !== 'sin-proveedor' &&
        (esPropio || producto.proveedor_id !== proveedorId)
      ) {
        return false;
      }

      return !termino || normalizar(producto.nombre).includes(termino);
    });
  }, [busqueda, productos, productosPropiosIds, proveedorId]);

  const grupos = useMemo(() => {
    const agrupados = new Map<
      string,
      { nombre: string; productos: ProductoProveedor[] }
    >();

    productosFiltrados.forEach((producto) => {
      const esPropio = productosPropiosIds.has(producto.id);
      const proveedor = proveedores.find(
        (actual) => actual.id === producto.proveedor_id
      );
      const clave = esPropio
        ? 'productos-propios'
        : producto.proveedor_id || 'sin-proveedor';
      const grupo = agrupados.get(clave) || {
        nombre: esPropio ? 'PRODUCTOS PROPIOS' : nombreProveedor(proveedor),
        productos: [],
      };
      grupo.productos.push(producto);
      agrupados.set(clave, grupo);
    });

    return [...agrupados.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    );
  }, [productosFiltrados, productosPropiosIds, proveedores]);

  return (
    <div className="space-y-6 pb-12">
      <style jsx global>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 8mm;
          }
          body {
            background: white !important;
          }
          body * {
            visibility: hidden !important;
          }
          .proveedores-print,
          .proveedores-print * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .proveedores-print {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
          .proveedor-encabezado {
            background-color: #91d04f !important;
          }
          .precio-cambio {
            background-color: #fde047 !important;
          }
        }
      `}</style>

      <header className="no-print flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-maruxa-rojo">
            Informes
          </p>
          <h1 className="mt-2 text-3xl font-black text-maruxa-chocolate">
            Productos por proveedor
          </h1>
          <p className="mt-2 text-sm font-bold text-maruxa-cafe/65">
            Consulta e imprime productos propios y productos separados por proveedor.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={productosFiltrados.length === 0}
          className="flex items-center justify-center gap-2 rounded-full bg-red-700 px-7 py-3 font-black text-white shadow-lg disabled:opacity-40"
        >
          <Printer className="h-5 w-5" />
          Imprimir
        </button>
      </header>

      <section className="no-print grid gap-4 rounded-3xl bg-white p-5 shadow-sm md:grid-cols-3">
        <label className="grid min-w-0 gap-1 text-xs font-black uppercase text-maruxa-cafe/60">
          Origen / proveedor
          <select
            value={proveedorId}
            onChange={(event) => setProveedorId(event.target.value)}
            className="h-11 w-full min-w-0 rounded-xl border bg-white px-3 text-sm font-bold normal-case text-maruxa-chocolate"
          >
            <option value="todos">Todos</option>
            <option value="productos-propios">Productos propios</option>
            <option value="sin-proveedor">Sin proveedor</option>
            {proveedores.map((proveedor) => (
              <option key={proveedor.id} value={proveedor.id}>
                {nombreProveedor(proveedor)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid min-w-0 gap-1 text-xs font-black uppercase text-maruxa-cafe/60">
          Valor 1/4
          <select
            value={mostrarCuarto ? 'mostrar' : 'ocultar'}
            onChange={(event) =>
              setMostrarCuarto(event.target.value === 'mostrar')
            }
            className="h-11 w-full min-w-0 rounded-xl border bg-white px-3 text-sm font-bold normal-case text-maruxa-chocolate"
          >
            <option value="mostrar">Mostrar 1/4</option>
            <option value="ocultar">Ocultar 1/4</option>
          </select>
        </label>

        <label className="grid min-w-0 gap-1 text-xs font-black uppercase text-maruxa-cafe/60">
          Buscar producto
          <span className="flex h-11 min-w-0 items-center gap-2 rounded-xl border px-3">
            <Search className="h-4 w-4 text-maruxa-cafe/45" />
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Nombre del producto"
              className="min-w-0 flex-1 bg-transparent text-sm font-bold normal-case outline-none"
            />
          </span>
        </label>
      </section>

      <section className="proveedores-print rounded-3xl bg-white p-5 shadow-sm">
        <div className="no-print mb-5 flex items-center justify-between gap-3 border-b pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-maruxa-rojo">
              Vista previa
            </p>
            <p className="font-black text-maruxa-chocolate">
              {productosFiltrados.length} productos · {grupos.length} grupos
            </p>
          </div>
        </div>

        {cargando ? (
          <p className="py-16 text-center font-black text-maruxa-cafe/50">
            Cargando productos...
          </p>
        ) : grupos.length === 0 ? (
          <p className="py-16 text-center font-black text-maruxa-cafe/50">
            No hay productos con precio para este filtro.
          </p>
        ) : (
          <div className="columns-1 gap-4 md:columns-2 print:columns-2">
            {grupos.map((grupo) => (
              <table
                key={grupo.nombre}
                className="mb-4 w-full break-inside-avoid border-collapse text-[11px]"
              >
                <thead>
                  <tr className="proveedor-encabezado bg-[#91D04F] text-maruxa-chocolate">
                    <th className="border border-black px-2 py-1 text-left text-sm font-black uppercase">
                      {grupo.nombre}
                    </th>
                    <th className="w-20 border border-black px-2 py-1 text-center font-black uppercase">
                      Kilo
                    </th>
                    {mostrarCuarto && (
                      <th className="w-16 border border-black px-2 py-1 text-center font-black uppercase">
                        1/4
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {grupo.productos.map((producto) => {
                    const esPropio = productosPropiosIds.has(producto.id);
                    const esKilo = normalizar(
                      producto.unidad_base || ''
                    ).includes('kg');

                    return (
                      <tr
                        key={producto.id}
                        className={
                          productosConCambio[producto.id]
                            ? 'precio-cambio bg-yellow-300'
                            : ''
                        }
                      >
                        <td className="border border-black px-2 py-1 font-bold uppercase">
                          {producto.nombre}
                          {!esPropio && !producto.proveedor_id && (
                            <Link
                              href={`/admin/compras?producto=${producto.id}`}
                              className="no-print ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black normal-case text-amber-900 underline"
                            >
                              Asignar proveedor
                            </Link>
                          )}
                        </td>
                        <td className="border border-black px-2 py-1 text-right font-bold">
                          {dinero(producto.precio)}
                        </td>
                        {mostrarCuarto && (
                          <td className="border border-black px-2 py-1 text-right font-bold">
                            {esKilo
                              ? dinero(Number(producto.precio || 0) / 4)
                              : ''}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
