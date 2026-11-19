'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Boxes, RefreshCw } from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';
import {
  diagnosticarStock,
  obtenerStockCritico,
  type ItemStockControlado,
} from '@/lib/stock-critico';
import { supabase } from '@/lib/supabase';

type FilaStock = ItemStockControlado & {
  codigo?: string | null;
  tipo?: string | null;
  costoUnitario: number;
  familiaId?: string | null;
  familiaNombre?: string | null;
};

type FamiliaProducto = {
  id: string;
  nombre: string;
  familia_padre_id: string | null;
};

type MovimientoStock = {
  id: string;
  producto_id: number;
  tipo_movimiento: string;
  cantidad: number;
  created_at: string;
  referencia_tipo: string | null;
  observacion: string | null;
  productos?: { nombre: string; unidad_base: string | null }[] | {
    nombre: string;
    unidad_base: string | null;
  } | null;
};

function numero(valor: unknown) {
  const resultado = Number(valor || 0);
  return Number.isFinite(resultado) ? resultado : 0;
}

function dinero(valor: number) {
  return `$${Math.round(valor || 0).toLocaleString('es-CL')}`;
}

function fechaHora(valor: string) {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(valor));
}

function hace30Dias() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - 30);
  return fecha.toISOString();
}

function nombreMovimiento(tipo: string) {
  if (tipo === 'compra') return 'Compra';
  if (tipo === 'salida') return 'Salida';
  if (tipo === 'entrada') return 'Entrada';
  if (tipo === 'ajuste') return 'Ajuste';
  return tipo || 'Movimiento';
}

function perteneceAFamilia(
  familiaId: string | null | undefined,
  familiaFiltroId: string,
  familiasPorId: Map<string, FamiliaProducto>
) {
  let actualId = familiaId || null;
  const visitadas = new Set<string>();

  while (actualId && !visitadas.has(actualId)) {
    if (actualId === familiaFiltroId) return true;
    visitadas.add(actualId);
    actualId = familiasPorId.get(actualId)?.familia_padre_id || null;
  }

  return false;
}

function etiquetaFamilia(familiaId: string | null | undefined, familiasPorId: Map<string, FamiliaProducto>) {
  const nombres: string[] = [];
  let actualId = familiaId || null;
  const visitadas = new Set<string>();

  while (actualId && !visitadas.has(actualId)) {
    const familia = familiasPorId.get(actualId);
    if (!familia) break;
    nombres.unshift(familia.nombre);
    visitadas.add(actualId);
    actualId = familia.familia_padre_id;
  }

  return nombres.join(' / ') || null;
}

export default function InformeStockCriticoPage() {
  const { perfil } = useAdminSession();
  const [items, setItems] = useState<FilaStock[]>([]);
  const [familias, setFamilias] = useState<FamiliaProducto[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoStock[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [familiaSeleccionada, setFamiliaSeleccionada] = useState('');
  const [soloCriticos, setSoloCriticos] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [errorMovimientos, setErrorMovimientos] = useState('');

  async function cargar() {
    if (!perfil?.empresa_id) return;
    setCargando(true);
    setError('');
    setErrorMovimientos('');

    const [{ data: productosData, error: errorProductos }, { data: ingredientesData, error: errorIngredientes }, { data: familiasData }] = await Promise.all([
      supabase
        .from('productos')
        .select('id,codigo,nombre,tipo_producto,familia_id,unidad_base,stock_actual,stock_minimo,controla_stock,costo_unitario')
        .eq('empresa_id', perfil.empresa_id)
        .eq('activo', true)
        .in('tipo_producto', ['producto', 'ingrediente', 'envase'])
        .order('nombre', { ascending: true }),
      supabase
        .from('ingredientes')
        .select('id,nombre,unidad_base,stock_actual,stock_minimo,afecta_stock,costo_unitario')
        .eq('empresa_id', perfil.empresa_id)
        .eq('activo', true)
        .order('nombre', { ascending: true }),
      supabase
        .from('familias_productos')
        .select('id,nombre,familia_padre_id')
        .eq('empresa_id', perfil.empresa_id)
        .eq('activo', true)
        .order('nombre', { ascending: true }),
    ]);

    if (errorProductos || errorIngredientes) {
      setItems([]);
      setMovimientos([]);
      setError(errorProductos?.message || errorIngredientes?.message || 'No se pudo cargar el stock.');
      setCargando(false);
      return;
    }

    const familiasCargadas = (familiasData || []) as FamiliaProducto[];
    const familiasPorId = new Map(familiasCargadas.map((familia) => [familia.id, familia]));
    setFamilias(familiasCargadas);

    const productos = (productosData || []).map((producto: any) => ({
      id: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      tipo: producto.tipo_producto,
      familiaId: producto.familia_id,
      familiaNombre: etiquetaFamilia(producto.familia_id, familiasPorId),
      unidadBase: producto.unidad_base,
      stockActual: producto.stock_actual,
      stockMinimo: producto.stock_minimo,
      controlaStock: producto.controla_stock,
      costoUnitario: numero(producto.costo_unitario),
      origen: 'productos' as const,
    }));
    const ingredientes = (ingredientesData || []).map((ingrediente: any) => ({
      id: ingrediente.id,
      nombre: ingrediente.nombre,
      tipo: 'materia_prima_antigua',
      familiaId: null,
      familiaNombre: null,
      unidadBase: ingrediente.unidad_base,
      stockActual: ingrediente.stock_actual,
      stockMinimo: ingrediente.stock_minimo,
      controlaStock: ingrediente.afecta_stock,
      costoUnitario: numero(ingrediente.costo_unitario),
      origen: 'ingredientes' as const,
    }));
    const productosIds = productos.map((producto) => Number(producto.id)).filter(Boolean);
    setItems([...productos, ...ingredientes] as FilaStock[]);

    if (productosIds.length === 0) {
      setMovimientos([]);
      setCargando(false);
      return;
    }

    const { data: movimientosData, error: errorHistorial } = await supabase
      .from('movimientos_stock')
      .select('id,producto_id,tipo_movimiento,cantidad,created_at,referencia_tipo,observacion,productos(nombre,unidad_base)')
      .eq('empresa_id', perfil.empresa_id)
      .in('producto_id', productosIds)
      .gte('created_at', hace30Dias())
      .order('created_at', { ascending: false })
      .limit(80);

    if (errorHistorial) {
      setMovimientos([]);
      setErrorMovimientos(errorHistorial.message);
    } else {
      setMovimientos((movimientosData || []) as MovimientoStock[]);
    }
    setCargando(false);
  }

  useEffect(() => {
    void cargar();
  }, [perfil?.empresa_id]);

  const criticos = useMemo(() => obtenerStockCritico(items), [items]);
  const familiasPorId = useMemo(() => new Map(familias.map((familia) => [familia.id, familia])), [familias]);
  const familiasParaFiltro = useMemo(
    () => familias.map((familia) => ({ ...familia, etiqueta: etiquetaFamilia(familia.id, familiasPorId) || familia.nombre })),
    [familias, familiasPorId]
  );
  const itemsVisibles = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es-CL');
    const fuente = soloCriticos ? criticos : items.map(diagnosticarStock);
    return fuente.filter((item) => {
      const coincideBusqueda = !termino ||
        `${item.codigo || ''} ${item.nombre} ${item.tipo || ''} ${item.unidadBase || ''} ${item.familiaNombre || ''}`
          .toLocaleLowerCase('es-CL')
          .includes(termino);
      const coincideFamilia = !familiaSeleccionada ||
        (familiaSeleccionada === '__sin_familia__'
          ? !item.familiaId
          : perteneceAFamilia(item.familiaId, familiaSeleccionada, familiasPorId));

      return coincideBusqueda && coincideFamilia;
    });
  }, [busqueda, criticos, familiaSeleccionada, familiasPorId, items, soloCriticos]);
  const agotados = criticos.filter((item) => item.estado === 'agotado').length;
  const bajoMinimo = criticos.filter((item) => item.estado === 'bajo_minimo').length;

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <Link href="/admin/productos" className="inline-flex items-center gap-2 text-xs font-black uppercase text-[#A51F2B]">
            <ArrowLeft className="h-4 w-4" /> Productos
          </Link>
          <p className="mt-3 text-xs font-black uppercase tracking-wide text-[#A51F2B]">Inventario</p>
          <h1 className="mt-1 text-3xl font-black text-[#2A1710]">Stock crítico y movimientos</h1>
          <p className="mt-2 max-w-3xl text-sm font-bold text-[#4B2818]/65">
            Controla existencias del catálogo actual y de materias primas antiguas. El informe no ajusta stock: solo muestra lo guardado.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void cargar()}
          disabled={cargando}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#2A1710] bg-white px-4 text-sm font-black text-[#2A1710] disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </header>

      {error ? (
        <p className="rounded-xl border border-red-300 bg-red-50 p-5 font-bold text-red-800">No se pudo cargar el informe: {error}</p>
      ) : cargando ? (
        <p className="rounded-xl border bg-white p-8 text-center font-black text-[#4B2818]/60">Cargando existencias...</p>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            {[
              ['Ítems con control de stock', items.filter((item) => item.controlaStock !== false).length, 'text-[#2A1710]'],
              ['Agotados', agotados, agotados ? 'text-red-700' : 'text-emerald-700'],
              ['Bajo mínimo', bajoMinimo, bajoMinimo ? 'text-amber-800' : 'text-emerald-700'],
            ].map(([etiqueta, valor, color]) => (
              <div key={String(etiqueta)} className="rounded-xl border bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-[#4B2818]/55">{etiqueta}</p>
                <p className={`mt-2 text-3xl font-black ${color}`}>{valor}</p>
              </div>
            ))}
          </section>

          {criticos.length > 0 && (
            <section className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-black">Hay {criticos.length} ítem(s) que requieren revisión.</p>
                <p className="mt-1 text-sm font-bold">Usa “Reponer” para abrir Compras con el producto seleccionado, o revisa la ficha de materias primas antiguas.</p>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-[#4B2818]/15 bg-white p-4 shadow-sm">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <h2 className="font-black text-[#2A1710]">Existencias</h2>
                <p className="mt-1 text-xs font-bold text-[#4B2818]/60">El mínimo corresponde a la ficha de cada producto o materia prima.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Buscar producto..."
                  className="h-10 rounded-md border px-3 text-sm font-bold"
                />
                <select
                  value={familiaSeleccionada}
                  onChange={(event) => setFamiliaSeleccionada(event.target.value)}
                  className="h-10 min-w-48 rounded-md border bg-white px-3 text-sm font-bold text-[#2A1710]"
                >
                  <option value="">Todas las familias</option>
                  <option value="__sin_familia__">Sin familia</option>
                  {familiasParaFiltro.map((familia) => (
                    <option key={familia.id} value={familia.id}>{familia.etiqueta}</option>
                  ))}
                </select>
                <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-black text-[#4B2818]">
                  <input type="checkbox" checked={soloCriticos} onChange={(event) => setSoloCriticos(event.target.checked)} className="h-4 w-4 accent-[#A51F2B]" />
                  Solo críticos
                </label>
              </div>
            </div>

            {itemsVisibles.length === 0 ? (
              <p className="p-8 text-center text-sm font-bold text-[#4B2818]/60">No hay ítems para el filtro seleccionado.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead className="bg-[#2A1710] text-white">
                    <tr>
                      <th className="px-3 py-3 text-left">Producto</th>
                      <th className="px-3 py-3 text-left">Origen</th>
                      <th className="px-3 py-3 text-right">Stock actual</th>
                      <th className="px-3 py-3 text-right">Mínimo</th>
                      <th className="px-3 py-3 text-right">Costo unitario</th>
                      <th className="px-3 py-3 text-right">Estado</th>
                      <th className="px-3 py-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsVisibles.map((item) => (
                      <tr key={`${item.origen}-${item.id}`} className={`border-b ${item.estado === 'agotado' ? 'bg-red-50' : item.estado === 'bajo_minimo' ? 'bg-amber-50' : ''}`}>
                        <td className="px-3 py-3">
                          <p className="font-black">{item.nombre}</p>
                          <p className="text-xs font-bold text-[#4B2818]/55">
                            {item.codigo || item.tipo || 'Sin código'} · {item.unidadBase || 'Sin unidad'}
                            {item.familiaNombre ? ` · ${item.familiaNombre}` : ' · Sin familia'}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-xs font-bold">{item.origen === 'productos' ? 'Catálogo actual' : 'Materia prima antigua'}</td>
                        <td className="px-3 py-3 text-right font-black">{item.stockActualNumero.toLocaleString('es-CL')}</td>
                        <td className="px-3 py-3 text-right">{item.stockMinimoNumero.toLocaleString('es-CL')}</td>
                        <td className="px-3 py-3 text-right">{dinero(item.costoUnitario || 0)}</td>
                        <td className="px-3 py-3 text-right">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${item.estado === 'agotado' ? 'bg-red-200 text-red-900' : item.estado === 'bajo_minimo' ? 'bg-amber-200 text-amber-950' : 'bg-emerald-100 text-emerald-800'}`}>
                            {item.estado === 'agotado' ? 'Agotado' : item.estado === 'bajo_minimo' ? 'Bajo mínimo' : 'Normal'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            href={item.origen === 'productos' ? `/admin/compras?producto=${item.id}` : '/admin/ingredientes'}
                            className="inline-flex rounded-md border border-[#A51F2B]/35 px-3 py-1.5 text-xs font-black text-[#A51F2B] hover:bg-[#FFF3DF]"
                          >
                            {item.origen === 'productos' ? 'Reponer' : 'Ver ficha'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-[#4B2818]/15 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-5 py-4">
              <Boxes className="h-5 w-5 text-[#A51F2B]" />
              <div>
                <h2 className="font-black text-[#2A1710]">Últimos movimientos del catálogo</h2>
                <p className="text-xs font-bold text-[#4B2818]/65">Últimos 30 días, registrados desde compras y otros movimientos de stock.</p>
              </div>
            </div>
            {errorMovimientos ? (
              <p className="p-5 text-sm font-bold text-red-700">No se pudo cargar los movimientos: {errorMovimientos}</p>
            ) : movimientos.length === 0 ? (
              <p className="p-8 text-center text-sm font-bold text-[#4B2818]/60">No hay movimientos de stock registrados en los últimos 30 días.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="border-b border-[#4B2818]/10 text-xs uppercase text-[#4B2818]/60">
                    <tr>
                      <th className="px-4 py-3 text-left">Fecha</th>
                      <th className="px-3 py-3 text-left">Producto</th>
                      <th className="px-3 py-3 text-left">Movimiento</th>
                      <th className="px-3 py-3 text-right">Cantidad</th>
                      <th className="px-4 py-3 text-left">Referencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#4B2818]/10">
                    {movimientos.map((movimiento) => {
                      const producto = Array.isArray(movimiento.productos) ? movimiento.productos[0] : movimiento.productos;
                      const esSalida = movimiento.tipo_movimiento === 'salida';
                      return (
                        <tr key={movimiento.id}>
                          <td className="px-4 py-3 font-bold">{fechaHora(movimiento.created_at)}</td>
                          <td className="px-3 py-3 font-black">{producto?.nombre || 'Producto eliminado'} <span className="text-xs text-[#4B2818]/55">/ {producto?.unidad_base || '-'}</span></td>
                          <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${esSalida ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{nombreMovimiento(movimiento.tipo_movimiento)}</span></td>
                          <td className={`px-3 py-3 text-right font-black ${esSalida ? 'text-red-700' : 'text-emerald-700'}`}>{esSalida ? '−' : '+'}{numero(movimiento.cantidad).toLocaleString('es-CL')}</td>
                          <td className="px-4 py-3 text-xs font-bold text-[#4B2818]/65">{movimiento.observacion || movimiento.referencia_tipo || 'Sin referencia'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
