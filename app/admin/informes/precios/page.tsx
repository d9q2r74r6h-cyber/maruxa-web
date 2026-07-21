'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckSquare, Printer, Search, Square } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdminSession } from '@/components/AdminSession';

type Familia = {
  id: string;
  nombre: string;
  familia_padre_id: string | null;
};

type ProductoPrecio = {
  id: number;
  nombre: string;
  precio: number | null;
  familia_id: string | null;
  proveedor_id: string | null;
  unidad_base: string | null;
  created_at: string | null;
};

type Proveedor = {
  id: string;
  razon_social: string;
  nombre_fantasia: string | null;
};

type DescripcionSuelta = {
  linea1: string;
  linea2: string;
  colorLinea1: string;
  colorLinea2: string;
};

const FUENTES_PRECIO = [
  {
    nombre: 'Amasis',
    valor: '"Amasis MT Pro", "Amasis MT", Amasis, Georgia, serif',
  },
  { nombre: 'Georgia', valor: 'Georgia, serif' },
  { nombre: 'Garamond', valor: 'Garamond, "Times New Roman", serif' },
  { nombre: 'Times New Roman', valor: '"Times New Roman", serif' },
  { nombre: 'Arial', valor: 'Arial, sans-serif' },
  { nombre: 'Trebuchet', valor: '"Trebuchet MS", sans-serif' },
  { nombre: 'Verdana', valor: 'Verdana, sans-serif' },
  { nombre: 'Courier New', valor: '"Courier New", monospace' },
];

const COLORES_PRIMARIOS = [
  { nombre: 'Negro', valor: '#2A1710' },
  { nombre: 'Rojo', valor: '#E00000' },
  { nombre: 'Amarillo', valor: '#F2C500' },
  { nombre: 'Azul', valor: '#0057D9' },
];

function colorLinea(texto: string, colorSeleccionado: string) {
  return /\boferta\b/i.test(normalizar(texto))
    ? '#E00000'
    : colorSeleccionado;
}

function dinero(valor: number | null | undefined) {
  return `$${Math.round(Number(valor || 0)).toLocaleString('es-CL')}`;
}

function normalizar(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function fechaChile(valor: string | null | undefined) {
  if (!valor) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(valor));
}

function dividirNombreProducto(nombre: string): DescripcionSuelta {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);

  if (palabras.length <= 1) {
    return {
      linea1: palabras[0] || '',
      linea2: '',
      colorLinea1: COLORES_PRIMARIOS[0].valor,
      colorLinea2: COLORES_PRIMARIOS[0].valor,
    };
  }

  let mejorCorte = 1;
  let menorDiferencia = Number.POSITIVE_INFINITY;

  for (let corte = 1; corte < palabras.length; corte += 1) {
    const linea1 = palabras.slice(0, corte).join(' ');
    const linea2 = palabras.slice(corte).join(' ');
    const diferencia = Math.abs(linea1.length - linea2.length);

    if (diferencia < menorDiferencia) {
      menorDiferencia = diferencia;
      mejorCorte = corte;
    }
  }

  return {
    linea1: palabras.slice(0, mejorCorte).join(' '),
    linea2: palabras.slice(mejorCorte).join(' '),
    colorLinea1: COLORES_PRIMARIOS[0].valor,
    colorLinea2: COLORES_PRIMARIOS[0].valor,
  };
}

export default function InformePreciosPage() {
  const { perfil } = useAdminSession();
  const [productos, setProductos] = useState<ProductoPrecio[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productosConCambio, setProductosConCambio] = useState<
    Record<number, boolean>
  >({});
  const [cargando, setCargando] = useState(true);
  const [formato, setFormato] = useState<'listado' | 'suelto'>('listado');
  const [fuentePrecio, setFuentePrecio] = useState(FUENTES_PRECIO[0].valor);
  const [negritaPrecio, setNegritaPrecio] = useState(true);
  const [tamanoLinea1, setTamanoLinea1] = useState(24);
  const [tamanoLinea2, setTamanoLinea2] = useState(24);
  const [mostrarCuarto, setMostrarCuarto] = useState(true);
  const [familiaId, setFamiliaId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [tipoFecha, setTipoFecha] = useState<
    'todos' | 'ingresados' | 'modificados'
  >('todos');
  const [fechaFiltro, setFechaFiltro] = useState(() =>
    fechaChile(new Date().toISOString())
  );
  const [fechasModificacion, setFechasModificacion] = useState<
    Record<number, string>
  >({});
  const [seleccionados, setSeleccionados] = useState<Record<number, boolean>>({});
  const [descripciones, setDescripciones] = useState<
    Record<number, DescripcionSuelta>
  >({});

  useEffect(() => {
    async function cargar() {
      if (!perfil) return;
      setCargando(true);

      const [
        { data: productosData, error },
        { data: familiasData },
        { data: proveedoresData },
      ] =
        await Promise.all([
          supabase
            .from('productos')
            .select('id,nombre,precio,familia_id,proveedor_id,unidad_base,created_at')
            .eq('empresa_id', perfil.empresa_id)
            .eq('activo', true)
            .eq('tipo_producto', 'producto')
            .order('nombre', { ascending: true }),
          supabase
            .from('familias_productos')
            .select('id,nombre,familia_padre_id')
            .eq('empresa_id', perfil.empresa_id)
            .eq('activo', true)
            .order('nombre', { ascending: true }),
          supabase
            .from('proveedores')
            .select('id,razon_social,nombre_fantasia')
            .eq('empresa_id', perfil.empresa_id)
            .order('nombre_fantasia', { ascending: true }),
        ]);

      if (error) {
        alert(error.message);
        setProductos([]);
        setFamilias([]);
        setProveedores([]);
        setCargando(false);
        return;
      }

      const productosConPrecio = ((productosData as ProductoPrecio[]) || []).filter(
        (producto) => Number(producto.precio || 0) > 0
      );
      const familiasActivas = (familiasData as Familia[]) || [];
      const productoIds = productosConPrecio.map((producto) => producto.id);
      const cambiosDetectados: Record<number, boolean> = {};
      const modificacionesDetectadas: Record<number, string> = {};

      if (productoIds.length > 0) {
        const { data: historialPrecios } = await supabase
          .from('producto_costos_historial')
          .select('producto_id,precio_venta,created_at')
          .eq('empresa_id', perfil.empresa_id)
          .in('producto_id', productoIds)
          .not('precio_venta', 'is', null)
          .order('created_at', { ascending: false })
          .limit(Math.min(1000, Math.max(100, productoIds.length * 4)));
        const preciosPorProducto = new Map<number, number[]>();

        for (const registro of historialPrecios || []) {
          const productoId = Number(registro.producto_id);
          if (!modificacionesDetectadas[productoId]) {
            modificacionesDetectadas[productoId] = registro.created_at;
          }
          const precios = preciosPorProducto.get(productoId) || [];
          if (precios.length >= 2) continue;
          precios.push(Number(registro.precio_venta || 0));
          preciosPorProducto.set(productoId, precios);
        }

        productosConPrecio.forEach((producto) => {
          const precios = preciosPorProducto.get(producto.id) || [];
          const precioVigente = Math.round(Number(producto.precio || 0));
          const ultimoPrecio = Math.round(Number(precios[0] || 0));
          const precioAnterior = Math.round(Number(precios[1] || 0));

          cambiosDetectados[producto.id] =
            (ultimoPrecio > 0 && precioVigente !== ultimoPrecio) ||
            (precioAnterior > 0 && ultimoPrecio !== precioAnterior);
        });
      }
      const familiaCecinas = familiasActivas.find((familia) =>
        normalizar(familia.nombre).includes('cecina')
      );
      const seleccionInicial: Record<number, boolean> = {};
      const descripcionesIniciales: Record<number, DescripcionSuelta> = {};

      productosConPrecio.forEach((producto) => {
        descripcionesIniciales[producto.id] = dividirNombreProducto(
          producto.nombre
        );
        if (familiaCecinas && producto.familia_id === familiaCecinas.id) {
          seleccionInicial[producto.id] = true;
        }
      });

      setProductos(productosConPrecio);
      setFamilias(familiasActivas);
      setProveedores((proveedoresData as Proveedor[]) || []);
      setProductosConCambio(cambiosDetectados);
      setFechasModificacion(modificacionesDetectadas);
      setFamiliaId(familiaCecinas?.id || '');
      setSeleccionados(seleccionInicial);
      setDescripciones(descripcionesIniciales);
      setCargando(false);
    }

    void cargar();
  }, [perfil]);

  const productosFiltrados = useMemo(() => {
    const termino = normalizar(busqueda.trim());
    return productos.filter((producto) => {
      if (familiaId && producto.familia_id !== familiaId) return false;
      if (
        tipoFecha === 'ingresados' &&
        fechaChile(producto.created_at) !== fechaFiltro
      ) {
        return false;
      }
      if (
        tipoFecha === 'modificados' &&
        fechaChile(fechasModificacion[producto.id]) !== fechaFiltro
      ) {
        return false;
      }
      return !termino || normalizar(producto.nombre).includes(termino);
    });
  }, [busqueda, familiaId, fechaFiltro, fechasModificacion, productos, tipoFecha]);

  const productosSeleccionados = useMemo(
    () => productos.filter((producto) => seleccionados[producto.id]),
    [productos, seleccionados]
  );

  const gruposListado = useMemo(() => {
    const grupos = new Map<string, { nombre: string; productos: ProductoPrecio[] }>();

    productosSeleccionados.forEach((producto) => {
      const familia = familias.find((item) => item.id === producto.familia_id);
      const proveedor = proveedores.find(
        (item) => item.id === producto.proveedor_id
      );
      const nombreFamilia = familia?.nombre || 'OTROS';
      const nombreProveedor =
        proveedor?.nombre_fantasia?.trim() ||
        proveedor?.razon_social ||
        'SIN PROVEEDOR';
      const clave = `familia:${familia?.id || 'sin-familia'}:proveedor:${
        proveedor?.id || 'sin-proveedor'
      }`;
      const grupo = grupos.get(clave) || {
        nombre: familiaId
          ? nombreProveedor
          : `${nombreFamilia} · ${nombreProveedor}`,
        productos: [],
      };
      grupo.productos.push(producto);
      grupos.set(clave, grupo);
    });

    return [...grupos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [familiaId, familias, productosSeleccionados, proveedores]);

  function seleccionarVisibles(valor: boolean) {
    setSeleccionados((actuales) => {
      const siguientes = { ...actuales };
      productosFiltrados.forEach((producto) => {
        siguientes[producto.id] = valor;
      });
      return siguientes;
    });
  }

  function cambiarFamilia(nuevaFamiliaId: string) {
    setFamiliaId(nuevaFamiliaId);
    setBusqueda('');

    const nuevaSeleccion: Record<number, boolean> = {};
    productos.forEach((producto) => {
      if (!nuevaFamiliaId || producto.familia_id === nuevaFamiliaId) {
        nuevaSeleccion[producto.id] = true;
      }
    });
    setSeleccionados(nuevaSeleccion);
  }

  function actualizarDescripcion(
    productoId: number,
    campo: keyof DescripcionSuelta,
    valor: string
  ) {
    setDescripciones((actuales) => ({
      ...actuales,
      [productoId]: {
        linea1: actuales[productoId]?.linea1 || '',
        linea2: actuales[productoId]?.linea2 || '',
        colorLinea1:
          actuales[productoId]?.colorLinea1 || COLORES_PRIMARIOS[0].valor,
        colorLinea2:
          actuales[productoId]?.colorLinea2 || COLORES_PRIMARIOS[0].valor,
        [campo]: valor,
      },
    }));
  }

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
          .precios-print,
          .precios-print * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .precios-print {
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
          .precio-encabezado {
            background-color: #91d04f !important;
          }
          .precio-cambio {
            background-color: #fde047 !important;
          }
          .precios-sueltos-grid {
            width: 680px !important;
            max-width: 100% !important;
            margin-inline: auto !important;
          }
        }
      `}</style>

      <header className="no-print flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-maruxa-rojo">
            Informes
          </p>
          <h1 className="mt-2 text-3xl font-black text-maruxa-chocolate">
            Listados de precios
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-bold text-maruxa-cafe/65">
            Selecciona productos y genera una lista para sala de ventas o tarjetas
            individuales de precio.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={productosSeleccionados.length === 0}
          className="flex items-center justify-center gap-2 rounded-full bg-red-700 px-7 py-3 font-black text-white shadow-lg disabled:opacity-40"
        >
          <Printer className="h-5 w-5" />
          Imprimir
        </button>
      </header>

      <section className="no-print grid gap-4 rounded-3xl bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-7">
        <label className="grid min-w-0 gap-1 text-xs font-black uppercase text-maruxa-cafe/60">
          Formato
          <select
            value={formato}
            onChange={(event) =>
              setFormato(event.target.value as 'listado' | 'suelto')
            }
            className="h-11 min-w-0 w-full rounded-xl border bg-white px-3 text-sm font-bold normal-case text-maruxa-chocolate"
          >
            <option value="listado">Precio listado</option>
            <option value="suelto">Precio suelto</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-black uppercase text-maruxa-cafe/60">
          Valor 1/4
          <select
            value={mostrarCuarto ? 'mostrar' : 'ocultar'}
            onChange={(event) =>
              setMostrarCuarto(event.target.value === 'mostrar')
            }
            disabled={formato !== 'listado'}
            className="h-11 min-w-0 w-full rounded-xl border bg-white px-3 text-sm font-bold normal-case text-maruxa-chocolate disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="mostrar">Mostrar 1/4</option>
            <option value="ocultar">Ocultar 1/4</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-black uppercase text-maruxa-cafe/60">
          Tipo de letra
          <select
            value={fuentePrecio}
            onChange={(event) => setFuentePrecio(event.target.value)}
            disabled={formato !== 'suelto'}
            className="h-11 min-w-0 w-full rounded-xl border bg-white px-3 text-sm font-bold normal-case text-maruxa-chocolate disabled:bg-gray-100 disabled:text-gray-400"
          >
            {FUENTES_PRECIO.map((fuente) => (
              <option key={fuente.nombre} value={fuente.valor}>
                {fuente.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-black uppercase text-maruxa-cafe/60">
          Grosor del texto
          <select
            value={negritaPrecio ? 'negrita' : 'normal'}
            onChange={(event) =>
              setNegritaPrecio(event.target.value === 'negrita')
            }
            disabled={formato !== 'suelto'}
            className="h-11 min-w-0 w-full rounded-xl border bg-white px-3 text-sm font-bold normal-case text-maruxa-chocolate disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="normal">Normal</option>
            <option value="negrita">Negrita</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-black uppercase text-maruxa-cafe/60">
          Tamaño línea 1
          <select
            value={tamanoLinea1}
            onChange={(event) => setTamanoLinea1(Number(event.target.value))}
            disabled={formato !== 'suelto'}
            className="h-11 min-w-0 w-full rounded-xl border bg-white px-3 text-sm font-bold normal-case text-maruxa-chocolate disabled:bg-gray-100 disabled:text-gray-400"
          >
            {[16, 18, 20, 24, 28, 32, 36].map((tamano) => (
              <option key={tamano} value={tamano}>
                {tamano} px
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-black uppercase text-maruxa-cafe/60">
          Tamaño línea 2
          <select
            value={tamanoLinea2}
            onChange={(event) => setTamanoLinea2(Number(event.target.value))}
            disabled={formato !== 'suelto'}
            className="h-11 min-w-0 w-full rounded-xl border bg-white px-3 text-sm font-bold normal-case text-maruxa-chocolate disabled:bg-gray-100 disabled:text-gray-400"
          >
            {[16, 18, 20, 24, 28, 32, 36].map((tamano) => (
              <option key={tamano} value={tamano}>
                {tamano} px
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-black uppercase text-maruxa-cafe/60">
          Familia
          <select
            value={familiaId}
            onChange={(event) => cambiarFamilia(event.target.value)}
            className="h-11 min-w-0 w-full rounded-xl border bg-white px-3 text-sm font-bold normal-case text-maruxa-chocolate"
          >
            <option value="">Todas las familias</option>
            {familias.map((familia) => (
              <option key={familia.id} value={familia.id}>
                {familia.familia_padre_id
                  ? `${familias.find((item) => item.id === familia.familia_padre_id)?.nombre || 'Familia'} › ${familia.nombre}`
                  : familia.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-black uppercase text-maruxa-cafe/60 xl:col-span-2">
          Buscar producto
          <span className="relative block h-11">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-maruxa-cafe/45" />
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Nombre del producto"
              className="h-11 w-full rounded-xl border bg-white pl-10 pr-3 text-sm font-bold normal-case outline-none"
            />
          </span>
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-black uppercase text-maruxa-cafe/60">
          Fecha de actividad
          <select
            value={tipoFecha}
            onChange={(event) =>
              setTipoFecha(
                event.target.value as 'todos' | 'ingresados' | 'modificados'
              )
            }
            className="h-11 min-w-0 w-full rounded-xl border bg-white px-3 text-sm font-bold normal-case text-maruxa-chocolate"
          >
            <option value="todos">Todos</option>
            <option value="ingresados">Ingresados</option>
            <option value="modificados">Modificados</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-black uppercase text-maruxa-cafe/60">
          Día
          <input
            type="date"
            value={fechaFiltro}
            onChange={(event) => setFechaFiltro(event.target.value)}
            disabled={tipoFecha === 'todos'}
            className="h-11 min-w-0 w-full rounded-xl border bg-white px-3 text-sm font-bold normal-case text-maruxa-chocolate disabled:bg-gray-100 disabled:text-gray-400"
          />
        </label>
      </section>

      <section className="no-print rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <p className="font-black text-maruxa-chocolate">
            {productosSeleccionados.length} productos seleccionados
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => seleccionarVisibles(true)}
              className="rounded-full border px-4 py-2 text-xs font-black"
            >
              Seleccionar visibles
            </button>
            <button
              type="button"
              onClick={() => seleccionarVisibles(false)}
              className="rounded-full border px-4 py-2 text-xs font-black"
            >
              Quitar visibles
            </button>
          </div>
        </div>

        {cargando ? (
          <p className="py-8 text-center font-bold">Cargando productos...</p>
        ) : productosFiltrados.length === 0 ? (
          <p className="py-8 text-center font-bold text-maruxa-cafe/55">
            No hay productos con precio de venta para este filtro.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {productosFiltrados.map((producto) => {
              const activo = Boolean(seleccionados[producto.id]);
              return (
                <div
                  key={producto.id}
                  className={`rounded-2xl border p-4 ${
                    activo ? 'border-red-300 bg-red-50/50' : 'bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSeleccionados((actuales) => ({
                        ...actuales,
                        [producto.id]: !activo,
                      }))
                    }
                    className="flex w-full items-start gap-3 text-left"
                  >
                    {activo ? (
                      <CheckSquare className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
                    ) : (
                      <Square className="mt-0.5 h-5 w-5 shrink-0 text-maruxa-cafe/40" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-black text-maruxa-chocolate">
                        {producto.nombre}
                      </span>
                      <span className="mt-1 block text-sm font-black text-red-700">
                        {dinero(producto.precio)}
                      </span>
                    </span>
                  </button>

                  {formato === 'suelto' && activo && (
                    <div className="mt-3 grid gap-2 border-t pt-3">
                      <div className="grid grid-cols-[1fr_96px] gap-2">
                        <input
                          value={
                            descripciones[producto.id]?.linea1 ?? producto.nombre
                          }
                          onChange={(event) =>
                            actualizarDescripcion(
                              producto.id,
                              'linea1',
                              event.target.value
                            )
                          }
                          style={{
                            color: colorLinea(
                              descripciones[producto.id]?.linea1 ||
                                producto.nombre,
                              descripciones[producto.id]?.colorLinea1 ||
                                COLORES_PRIMARIOS[0].valor
                            ),
                          }}
                          placeholder="Título"
                          className="min-w-0 rounded-lg border bg-white px-3 py-2 text-xs font-bold"
                        />
                        <select
                          aria-label={`Color línea 1 de ${producto.nombre}`}
                          value={colorLinea(
                            descripciones[producto.id]?.linea1 || producto.nombre,
                            descripciones[producto.id]?.colorLinea1 ||
                              COLORES_PRIMARIOS[0].valor
                          )}
                          onChange={(event) =>
                            actualizarDescripcion(
                              producto.id,
                              'colorLinea1',
                              event.target.value
                            )
                          }
                          style={{
                            color: colorLinea(
                              descripciones[producto.id]?.linea1 ||
                                producto.nombre,
                              descripciones[producto.id]?.colorLinea1 ||
                                COLORES_PRIMARIOS[0].valor
                            ),
                          }}
                          className="h-full min-w-0 rounded-lg border bg-white px-1 text-xs font-black"
                        >
                          {COLORES_PRIMARIOS.map((color) => (
                            <option key={color.valor} value={color.valor}>
                              {color.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-[1fr_96px] gap-2">
                        <input
                          value={descripciones[producto.id]?.linea2 || ''}
                          onChange={(event) =>
                            actualizarDescripcion(
                              producto.id,
                              'linea2',
                              event.target.value
                            )
                          }
                          style={{
                            color: colorLinea(
                              descripciones[producto.id]?.linea2 || '',
                              descripciones[producto.id]?.colorLinea2 ||
                                COLORES_PRIMARIOS[0].valor
                            ),
                          }}
                          placeholder="Descripción opcional"
                          className="min-w-0 rounded-lg border bg-white px-3 py-2 text-xs font-bold"
                        />
                        <select
                          aria-label={`Color línea 2 de ${producto.nombre}`}
                          value={colorLinea(
                            descripciones[producto.id]?.linea2 || '',
                            descripciones[producto.id]?.colorLinea2 ||
                              COLORES_PRIMARIOS[0].valor
                          )}
                          onChange={(event) =>
                            actualizarDescripcion(
                              producto.id,
                              'colorLinea2',
                              event.target.value
                            )
                          }
                          style={{
                            color: colorLinea(
                              descripciones[producto.id]?.linea2 || '',
                              descripciones[producto.id]?.colorLinea2 ||
                                COLORES_PRIMARIOS[0].valor
                            ),
                          }}
                          className="h-full min-w-0 rounded-lg border bg-white px-1 text-xs font-black"
                        >
                          {COLORES_PRIMARIOS.map((color) => (
                            <option key={color.valor} value={color.valor}>
                              {color.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="precios-print rounded-3xl bg-white p-5 shadow-sm">
        <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-maruxa-rojo">
              Vista previa
            </p>
            <p className="font-black text-maruxa-chocolate">
              {formato === 'listado' ? 'Precio listado' : 'Precio suelto'} ·{' '}
              {productosSeleccionados.length} productos
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={productosSeleccionados.length === 0}
            className="flex items-center justify-center gap-2 rounded-full bg-red-700 px-7 py-3 font-black text-white shadow-lg disabled:opacity-40"
          >
            <Printer className="h-5 w-5" />
            Imprimir {formato === 'listado' ? 'listado' : 'precios'}
          </button>
        </div>

        {formato === 'listado' ? (
          <div className="columns-1 gap-4 md:columns-2 print:columns-2">
            {gruposListado.map((grupo) => (
              <table
                key={grupo.nombre}
                className="mb-4 w-full break-inside-avoid border-collapse text-[11px]"
              >
                <thead>
                  <tr className="precio-encabezado bg-[#91D04F] text-maruxa-chocolate">
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
                    const esKilo = normalizar(producto.unidad_base || '').includes(
                      'kg'
                    );
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
                          {!producto.proveedor_id && (
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
                            {esKilo ? dinero(Number(producto.precio || 0) / 4) : ''}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ))}
          </div>
        ) : (
          <div className="precios-sueltos-grid mx-auto grid w-full max-w-[680px] grid-cols-2">
            {productosSeleccionados.map((producto) => {
              const descripcion = descripciones[producto.id];
              return (
                <article
                  key={producto.id}
                  style={{
                    fontFamily: fuentePrecio,
                    fontWeight: negritaPrecio ? 900 : 400,
                  }}
                  className="flex min-h-[150px] break-inside-avoid flex-col items-center justify-center border-2 border-black px-3 py-2 text-center"
                >
                  <h2
                    style={{
                      fontFamily: fuentePrecio,
                      fontWeight: negritaPrecio ? 900 : 400,
                      fontSize: `${tamanoLinea1}px`,
                      color: colorLinea(
                        descripcion?.linea1 || producto.nombre,
                        descripcion?.colorLinea1 || COLORES_PRIMARIOS[0].valor
                      ),
                    }}
                    className="text-2xl font-black uppercase leading-tight"
                  >
                    {descripcion?.linea1 || producto.nombre}
                  </h2>
                  {descripcion?.linea2 && (
                    <p
                      style={{
                        fontFamily: fuentePrecio,
                        fontWeight: negritaPrecio ? 900 : 400,
                        fontSize: `${tamanoLinea2}px`,
                        color: colorLinea(
                          descripcion?.linea2 || '',
                          descripcion?.colorLinea2 || COLORES_PRIMARIOS[0].valor
                        ),
                      }}
                      className="text-lg font-bold uppercase leading-tight"
                    >
                      {descripcion.linea2}
                    </p>
                  )}
                  <p
                    style={{
                      fontFamily: fuentePrecio,
                      fontWeight: negritaPrecio ? 900 : 400,
                    }}
                    className="mt-3 text-5xl font-black leading-none"
                  >
                    {dinero(producto.precio)}
                  </p>
                </article>
              );
            })}
          </div>
        )}

        {productosSeleccionados.length === 0 && (
          <p className="py-20 text-center font-black text-maruxa-cafe/45">
            Selecciona productos para generar la vista de impresión.
          </p>
        )}
      </section>
    </div>
  );
}
