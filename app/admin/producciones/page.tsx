'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';
import { registrarMovimientoInventario } from '@/lib/inventario';

type Receta = {
  id: string;
  nombre: string;
  producto_id: string;
  rendimiento_kg: number;
  unidades_producidas: number;
  productos?: {
    nombre: string;
  };
};

type IngredienteReceta = {
  id: string;
  receta_id: string;
  ingrediente_id: string;
  cantidad: number;
  ingredientes: {
    id: string;
    nombre: string;
    unidad_base: string;
    costo_unitario: number;
    stock_actual: number;
  };
};

export default function AdminProduccionPage() {
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [detalleReceta, setDetalleReceta] = useState<IngredienteReceta[]>([]);
  const [recetaId, setRecetaId] = useState('');
  const [cantidadObjetivo, setCantidadObjetivo] = useState('1');
  const [loading, setLoading] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const recetaSeleccionada = recetas.find((receta) => receta.id === recetaId);

  const factorProduccion = useMemo(() => {
    const unidadesBase = Number(recetaSeleccionada?.unidades_producidas || 0);
    const cantidad = Number(cantidadObjetivo || 0);

    if (unidadesBase <= 0) return 0;

    return cantidad / unidadesBase;
  }, [recetaSeleccionada, cantidadObjetivo]);

  const ingredientesCalculados = useMemo(() => {
    return detalleReceta.map((item) => {
      const cantidadNecesaria = Number(item.cantidad || 0) * factorProduccion;
      const costo = cantidadNecesaria * Number(item.ingredientes.costo_unitario || 0);
      const stockActual = Number(item.ingredientes.stock_actual || 0);
      const diferencia = stockActual - cantidadNecesaria;

      return {
        ...item,
        cantidadNecesaria,
        costo,
        stockActual,
        diferencia,
        stockSuficiente: diferencia >= 0,
      };
    });
  }, [detalleReceta, factorProduccion]);

  const costoTotal = ingredientesCalculados.reduce(
    (total, item) => total + item.costo,
    0
  );

  const hayFaltantes = ingredientesCalculados.some(
    (item) => !item.stockSuficiente
  );

  async function cargarRecetas() {
    setLoading(true);

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('recetas')
      .select(`
        id,
        nombre,
        producto_id,
        rendimiento_kg,
        unidades_producidas,
        productos (
          nombre
        )
      `)
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setRecetas((data as Receta[]) || []);
    setLoading(false);
  }

  async function calcularProduccion() {
    if (!recetaId) {
      alert('Selecciona una receta.');
      return;
    }

    setCalculando(true);

    const { data, error } = await supabase
      .from('receta_ingredientes')
      .select(`
        id,
        receta_id,
        ingrediente_id,
        cantidad,
        ingredientes (
          id,
          nombre,
          unidad_base,
          costo_unitario,
          stock_actual
        )
      `)
      .eq('receta_id', recetaId);

    if (error) {
      alert(error.message);
      setCalculando(false);
      return;
    }

    setDetalleReceta((data as IngredienteReceta[]) || []);
    setCalculando(false);
  }

  async function confirmarProduccion() {
    if (!recetaSeleccionada) return;

    if (hayFaltantes) {
      alert('Hay ingredientes sin stock suficiente.');
      return;
    }

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      return;
    }

    setConfirmando(true);

    const cantidadUnidades = Number(cantidadObjetivo || 0);
    const cantidadKg =
      Number(recetaSeleccionada.rendimiento_kg || 0) * factorProduccion;

    const { data: produccion, error: errorProduccion } = await supabase
      .from('producciones')
      .insert({
        empresa_id: empresa.id,
        receta_id: recetaSeleccionada.id,
        cantidad_unidades: cantidadUnidades,
        cantidad_kg: cantidadKg,
        costo_total: costoTotal,
        estado: 'confirmada',
      })
      .select('id')
      .single();

    if (errorProduccion) {
      alert(errorProduccion.message);
      setConfirmando(false);
      return;
    }

    const detalle = ingredientesCalculados.map((item) => ({
      produccion_id: produccion.id,
      ingrediente_id: item.ingrediente_id,
      cantidad: item.cantidadNecesaria,
      costo: item.costo,
    }));

    const { error: errorDetalle } = await supabase
      .from('produccion_detalle')
      .insert(detalle);

    if (errorDetalle) {
      alert(errorDetalle.message);
      setConfirmando(false);
      return;
    }

    for (const item of ingredientesCalculados) {
      await registrarMovimientoInventario({
        ingredienteId: item.ingrediente_id,
        tipo: 'salida',
        cantidad: item.cantidadNecesaria,
        motivo: 'Consumo por producción',
        referenciaTipo: 'produccion',
        referenciaId: produccion.id,
      });
    }

    alert('Producción confirmada e inventario actualizado.');
    setDetalleReceta([]);
    setCantidadObjetivo('1');
    setRecetaId('');
    setConfirmando(false);
  }

  useEffect(() => {
    cargarRecetas();
  }, []);

  return (
    <main className="min-h-screen bg-maruxa-crema px-5 py-12">
      <div className="mx-auto max-w-7xl">
        <p className="font-black uppercase tracking-[.24em] text-red-700">
          Producción
        </p>

        <h1 className="mt-3 text-5xl font-black text-maruxa-chocolate">
          Nueva producción
        </h1>

        <section className="mt-10 rounded-[34px] bg-white p-6 shadow-premium">
          <h2 className="text-2xl font-black text-maruxa-chocolate">
            Calcular producción
          </h2>

          {loading ? (
            <p className="mt-6 font-black">Cargando recetas...</p>
          ) : (
            <>
              <div className="mt-6 grid gap-5 md:grid-cols-3">
                <div className="rounded-2xl border bg-white p-4">
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-500">
                    Receta
                  </label>

                  <select
                    value={recetaId}
                    onChange={(e) => {
                      setRecetaId(e.target.value);
                      setDetalleReceta([]);
                    }}
                    className="w-full bg-transparent text-lg font-black outline-none"
                  >
                    <option value="">Seleccionar receta</option>
                    {recetas.map((receta) => (
                      <option key={receta.id} value={receta.id}>
                        {receta.productos?.nombre || receta.nombre} — {receta.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-500">
                    Unidades a producir
                  </label>

                  <input
                    type="number"
                    value={cantidadObjetivo}
                    onChange={(e) => setCantidadObjetivo(e.target.value)}
                    className="w-full bg-transparent text-lg font-black outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={calcularProduccion}
                  disabled={calculando}
                  className="rounded-2xl bg-red-700 px-6 py-4 font-black text-white shadow-lg transition hover:bg-red-800 disabled:opacity-50"
                >
                  {calculando ? 'Calculando...' : 'Calcular producción'}
                </button>
              </div>
            </>
          )}
        </section>

        {detalleReceta.length > 0 && (
          <section className="mt-8 rounded-[34px] bg-white p-6 shadow-premium">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-black text-maruxa-chocolate">
                  Ingredientes necesarios
                </h2>

                <p className="mt-1 font-bold text-gray-600">
                  Factor producción: ×
                  {factorProduccion.toLocaleString('es-CL', {
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div className="rounded-2xl bg-maruxa-crema px-5 py-4 font-black text-maruxa-chocolate">
                Costo estimado: ${costoTotal.toLocaleString('es-CL')}
              </div>
            </div>

            <div className="mt-6 overflow-x-auto rounded-2xl border">
              <table className="w-full text-sm">
                <thead className="bg-red-700 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Ingrediente</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3 text-right">Necesario</th>
                    <th className="px-4 py-3 text-right">Diferencia</th>
                    <th className="px-4 py-3 text-right">Costo</th>
                  </tr>
                </thead>

                <tbody>
                  {ingredientesCalculados.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b last:border-none hover:bg-maruxa-crema/40"
                    >
                      <td className="px-4 py-3 font-bold">
                        {item.ingredientes.nombre}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {item.stockActual.toLocaleString('es-CL')}{' '}
                        {item.ingredientes.unidad_base}
                      </td>

                      <td className="px-4 py-3 text-right font-black">
                        {item.cantidadNecesaria.toLocaleString('es-CL', {
                          maximumFractionDigits: 4,
                        })}{' '}
                        {item.ingredientes.unidad_base}
                      </td>

                      <td
                        className={`px-4 py-3 text-right font-black ${
                          item.stockSuficiente
                            ? 'text-green-700'
                            : 'text-red-700'
                        }`}
                      >
                        {item.stockSuficiente ? '✅ ' : '❌ '}
                        {item.diferencia.toLocaleString('es-CL', {
                          maximumFractionDigits: 4,
                        })}
                      </td>

                      <td className="px-4 py-3 text-right font-black text-maruxa-vino">
                        ${item.costo.toLocaleString('es-CL')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hayFaltantes && (
              <div className="mt-5 rounded-2xl border border-red-300 bg-red-50 p-4 font-black text-red-700">
                Hay ingredientes con stock insuficiente. No se puede confirmar la
                producción.
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={confirmarProduccion}
                disabled={confirmando || hayFaltantes}
                className="rounded-full bg-red-700 px-8 py-4 font-black text-white shadow-lg transition hover:bg-red-800 disabled:opacity-50"
              >
                {confirmando
                  ? 'Confirmando...'
                  : 'Confirmar producción y descontar inventario'}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}