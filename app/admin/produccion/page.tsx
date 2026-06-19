'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';
import { AdminMenu } from '@/components/AdminMenu';

type Receta = {
  id: string;
  nombre: string;
  producto_id: number;
  unidades_producidas: number;
  productos?: {
    nombre: string;
  } | null;
};

export default function AdminProduccionPage() {
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [recetaId, setRecetaId] = useState('');
  const [lotes, setLotes] = useState('1');
  const [loading, setLoading] = useState(true);
  const [fabricando, setFabricando] = useState(false);

  async function cargarRecetas() {
    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      return;
    }

    const { data, error } = await supabase
      .from('recetas')
      .select(`
        id,
        nombre,
        producto_id,
        unidades_producidas,
        productos (
          nombre
        )
      `)
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('nombre');

    if (error) {
      alert(error.message);
      return;
    }

    setRecetas((data as unknown as Receta[]) || []);
  }

  useEffect(() => {
    async function iniciar() {
      setLoading(true);
      await cargarRecetas();
      setLoading(false);
    }

    iniciar();
  }, []);

  async function fabricar() {
    if (!recetaId) {
      alert('Selecciona una receta.');
      return;
    }

    const cantidadLotes = Number(String(lotes).replace(',', '.') || 0);

    if (cantidadLotes <= 0) {
      alert('Ingresa una cantidad de lotes válida.');
      return;
    }

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      return;
    }

    const receta = recetas.find((item) => item.id === recetaId);

    if (!receta) {
      alert('No se encontró la receta.');
      return;
    }

    setFabricando(true);

    const { data: detalles, error: errorDetalles } = await supabase
      .from('receta_ingredientes')
      .select(`
        ingrediente_id,
        cantidad,
        productos (
          id,
          nombre,
          tipo_producto,
          controla_stock
        )
      `)
      .eq('receta_id', recetaId);

    if (errorDetalles) {
      alert(errorDetalles.message);
      setFabricando(false);
      return;
    }

    const movimientos = [];

    for (const detalle of detalles || []) {
      const producto = Array.isArray(detalle.productos)
        ? detalle.productos[0]
        : detalle.productos;

      if (!producto?.controla_stock) continue;

      movimientos.push({
        empresa_id: empresa.id,
        producto_id: Number(detalle.ingrediente_id),
        tipo_movimiento: 'salida_fabricacion',
        cantidad: Number(detalle.cantidad || 0) * cantidadLotes * -1,
        referencia_tipo: 'receta',
        referencia_id: recetaId,
        observacion: `Fabricación receta ${receta.nombre}`,
      });

      const { error: errorStock } = await supabase.rpc(
        'actualizar_stock_producto',
        {
          producto_id_param: Number(detalle.ingrediente_id),
          cantidad_param: Number(detalle.cantidad || 0) * cantidadLotes * -1,
        }
      );

      if (errorStock) {
        alert(errorStock.message);
        setFabricando(false);
        return;
      }
    }

    const cantidadProducida =
      Number(receta.unidades_producidas || 1) * cantidadLotes;

    movimientos.push({
      empresa_id: empresa.id,
      producto_id: Number(receta.producto_id),
      tipo_movimiento: 'entrada_fabricacion',
      cantidad: cantidadProducida,
      referencia_tipo: 'receta',
      referencia_id: recetaId,
      observacion: `Producción de ${receta.productos?.nombre || receta.nombre}`,
    });

    const { error: errorStockProducto } = await supabase.rpc(
      'actualizar_stock_producto',
      {
        producto_id_param: Number(receta.producto_id),
        cantidad_param: cantidadProducida,
      }
    );

    if (errorStockProducto) {
      alert(errorStockProducto.message);
      setFabricando(false);
      return;
    }

    const { error: errorMovimientos } = await supabase
      .from('movimientos_stock')
      .insert(movimientos);

    if (errorMovimientos) {
      alert(errorMovimientos.message);
      setFabricando(false);
      return;
    }

    setFabricando(false);
    alert('Fabricación registrada correctamente.');
  }

  return (
    <main className="min-h-screen bg-maruxa-crema px-5 py-12">
      <div className="mx-auto max-w-5xl">
       

        <p className="font-black uppercase tracking-[.24em] text-maruxa-rojo">
          Producción
        </p>

        <h1 className="mt-3 text-5xl font-black text-maruxa-chocolate">
          Fabricación
        </h1>

        <section className="mt-10 rounded-[34px] bg-white p-6 shadow-premium">
          {loading ? (
            <p className="font-black">Cargando recetas...</p>
          ) : (
            <div className="grid gap-5 md:grid-cols-3">
              <div className="rounded-2xl border bg-white p-4 md:col-span-2">
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-500">
                  Receta
                </label>

                <select
                  value={recetaId}
                  onChange={(e) => setRecetaId(e.target.value)}
                  className="w-full bg-transparent text-lg font-black outline-none"
                >
                  <option value="">Seleccionar receta</option>
                  {recetas.map((receta) => (
                    <option key={receta.id} value={receta.id}>
                      {receta.productos?.nombre || receta.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-500">
                  Lotes
                </label>

                <input
                  type="number"
                  value={lotes}
                  onChange={(e) => setLotes(e.target.value)}
                  className="w-full bg-transparent text-lg font-black outline-none"
                />
              </div>

              <div className="md:col-span-3">
                <button
                  type="button"
                  onClick={fabricar}
                  disabled={fabricando}
                  className="rounded-full bg-maruxa-rojo px-8 py-4 font-black text-white shadow-lg"
                >
                  {fabricando ? 'Fabricando...' : 'Fabricar'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}