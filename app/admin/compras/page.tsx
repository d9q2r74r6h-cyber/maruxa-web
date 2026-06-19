'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';
import { registrarMovimientoInventario } from '@/lib/inventario';
import { AdminMenu } from '@/components/AdminMenu';

type Ingrediente = {
  id: string;
  nombre: string;
  unidad_base: string;
  costo_unitario: number;
  stock_actual: number;
  activo: boolean;
  iva_porcentaje: number;
impuesto_adicional_porcentaje: number;
};

type LineaCompra = {
  ingrediente_id: string;
  cantidad: string;
  costo_unitario: string;
};

const lineaInicial: LineaCompra = {
  ingrediente_id: '',
  cantidad: '',
  costo_unitario: '',
};

export default function AdminComprasPage() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [proveedor, setProveedor] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [lineas, setLineas] = useState<LineaCompra[]>([lineaInicial]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const lineasCalculadas = useMemo(() => {
    return lineas.map((linea) => {
      const ingrediente = ingredientes.find(
        (item) => item.id === linea.ingrediente_id
      );
  
      const cantidad = Number(linea.cantidad || 0);
      const costoNeto = Number(linea.costo_unitario || 0);
  
      const iva = Number(ingrediente?.iva_porcentaje || 0);
      const impuestoAdicional = Number(
        ingrediente?.impuesto_adicional_porcentaje || 0
      );
  
      const costoFinalUnitario =
        costoNeto * (1 + iva / 100 + impuestoAdicional / 100);
  
      const subtotal = cantidad * costoFinalUnitario;
  
      return {
        ...linea,
        ingrediente,
        cantidad,
        costoNeto,
        iva,
        impuestoAdicional,
        costoFinalUnitario,
        subtotal,
      };
    });
  }, [lineas, ingredientes]);

  const totalCompra = useMemo(() => {
    return lineasCalculadas.reduce(
      (total, linea) => total + linea.subtotal,
      0
    );
  }, [lineasCalculadas]);


  async function cargarIngredientes() {
    setLoading(true);

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('ingredientes')
      .select('id,nombre,unidad_base,costo_unitario,stock_actual,activo,iva_porcentaje,impuesto_adicional_porcentaje')
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setIngredientes((data as Ingrediente[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    cargarIngredientes();
  }, []);

  function agregarLinea() {
    setLineas([...lineas, { ...lineaInicial }]);
  }

  function eliminarLinea(index: number) {
    if (lineas.length === 1) return;
    setLineas(lineas.filter((_, i) => i !== index));
  }

  function actualizarLinea(
    index: number,
    campo: keyof LineaCompra,
    valor: string
  ) {
    setLineas(
      lineas.map((linea, i) =>
        i === index ? { ...linea, [campo]: valor } : linea
      )
    );
  }

  function seleccionarIngrediente(index: number, ingredienteId: string) {
    const ingrediente = ingredientes.find((item) => item.id === ingredienteId);

    setLineas(
      lineas.map((linea, i) =>
        i === index
          ? {
              ...linea,
              ingrediente_id: ingredienteId,
              costo_unitario: ingrediente
                ? String(ingrediente.costo_unitario || '')
                : '',
            }
          : linea
      )
    );
  }

  function limpiarFormulario() {
    setProveedor('');
    setObservaciones('');
    setLineas([{ ...lineaInicial }]);
  }

  async function confirmarCompra() {
    const lineasValidas = lineasCalculadas.filter(
        (linea) =>
          linea.ingrediente_id &&
          linea.cantidad > 0 &&
          linea.costoNeto >= 0
      );

    if (lineasValidas.length === 0) {
      alert('Agrega al menos una línea válida.');
      return;
    }

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      return;
    }

    setGuardando(true);

    const { data: compra, error: errorCompra } = await supabase
      .from('compras')
      .insert({
        empresa_id: empresa.id,
        proveedor: proveedor || null,
        observaciones: observaciones || null,
        total: totalCompra,
      })
      .select('id')
      .single();

    if (errorCompra) {
      alert(errorCompra.message);
      setGuardando(false);
      return;
    }

    const detalle = lineasValidas.map((linea) => ({
      compra_id: compra.id,
      ingrediente_id: linea.ingrediente_id,
      cantidad: linea.cantidad,
      costo_unitario: linea.costoNeto,
      subtotal: linea.subtotal,
    }));

    const { error: errorDetalle } = await supabase
      .from('compra_detalle')
      .insert(detalle);

    if (errorDetalle) {
      alert(errorDetalle.message);
      setGuardando(false);
      return;
    }

    for (const linea of lineasValidas) {
      await registrarMovimientoInventario({
        ingredienteId: linea.ingrediente_id,
        tipo: 'entrada',
        cantidad: linea.cantidad,
        motivo: 'Ingreso por compra',
        referenciaTipo: 'compra',
        referenciaId: compra.id,
      });

      await supabase
        .from('ingredientes')
        .update({
          costo_unitario: linea.costoNeto,
        })
        .eq('id', linea.ingrediente_id)
        .eq('empresa_id', empresa.id);
    }

    alert('Compra ingresada e inventario actualizado.');
    limpiarFormulario();
    cargarIngredientes();
    setGuardando(false);
  }

  return (
    <main className="min-h-screen bg-maruxa-crema px-5 py-12">
      <div className="mx-auto max-w-7xl">
        <p className="font-black uppercase tracking-[.24em] text-red-700">
          Inventario
        </p>

        <h1 className="mt-3 text-5xl font-black text-maruxa-chocolate">
          Compras / ingreso de stock
        </h1>

        <section className="mt-10 rounded-[34px] bg-white p-6 shadow-premium">
          <h2 className="text-2xl font-black text-maruxa-chocolate">
            Nueva compra
          </h2>

          {loading ? (
            <p className="mt-6 font-black">Cargando ingredientes...</p>
          ) : (
            <>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border bg-white p-4">
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-500">
                    Proveedor
                  </label>

                  <input
                    value={proveedor}
                    onChange={(e) => setProveedor(e.target.value)}
                    placeholder="Ej: Molino, distribuidor, proveedor"
                    className="w-full bg-transparent text-lg font-black outline-none"
                  />
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-500">
                    Observaciones
                  </label>

                  <input
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Ej: factura, guía, comentario"
                    className="w-full bg-transparent text-lg font-black outline-none"
                  />
                </div>
              </div>

              <div className="mt-8 rounded-[28px] border border-maruxa-crema bg-maruxa-crema p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <h3 className="text-xl font-black text-maruxa-chocolate">
                    Detalle de compra
                  </h3>

                  <button
                    type="button"
                    onClick={agregarLinea}
                    className="rounded-full border-2 border-red-700 bg-red-700 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:bg-red-800"
                  >
                    + Agregar línea
                  </button>
                </div>

                <div className="mt-5 grid gap-3">
                  {lineas.map((linea, index) => {
                    const ingrediente = ingredientes.find(
                      (item) => item.id === linea.ingrediente_id
                    );

                                        const costoFinalUnitario =
                    Number(linea.costo_unitario || 0) *
                    (1 +
                        Number(ingrediente?.iva_porcentaje || 0) / 100 +
                        Number(ingrediente?.impuesto_adicional_porcentaje || 0) / 100);

                    const subtotal =
                    Number(linea.cantidad || 0) * costoFinalUnitario;
                    return (
                      <div
                        key={index}
                        className="grid gap-3 rounded-2xl bg-white p-4 md:grid-cols-[1fr_130px_160px_120px_auto]"
                      >
                        <select
                          value={linea.ingrediente_id}
                          onChange={(e) =>
                            seleccionarIngrediente(index, e.target.value)
                          }
                          className="rounded-2xl border px-4 py-3 font-bold"
                        >
                          <option value="">Ingrediente</option>
                          {ingredientes.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.nombre}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          value={linea.cantidad}
                          onChange={(e) =>
                            actualizarLinea(index, 'cantidad', e.target.value)
                          }
                          placeholder="Cantidad"
                          className="rounded-2xl border px-4 py-3 font-bold"
                        />

                        <input
                          type="number"
                          value={linea.costo_unitario}
                          onChange={(e) =>
                            actualizarLinea(
                              index,
                              'costo_unitario',
                              e.target.value
                            )
                          }
                          placeholder="Costo neto unitario"
                          className="rounded-2xl border px-4 py-3 font-bold"
                        />

                        <div className="rounded-2xl bg-gray-100 px-4 py-3 font-black text-maruxa-chocolate">
                        {ingrediente?.unidad_base || '-'}
                        <br />
                        <span className="text-xs text-gray-500">
                            Final unit.: $
                            {(Number(linea.costo_unitario || 0) *
                            (1 +
                                Number(ingrediente?.iva_porcentaje || 0) / 100 +
                                Number(ingrediente?.impuesto_adicional_porcentaje || 0) / 100)
                            ).toLocaleString('es-CL')}
                        </span>
                        <br />
                        <span className="text-xs text-gray-500">
                            Subtotal: ${subtotal.toLocaleString('es-CL')}
                        </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => eliminarLinea(index)}
                          className="rounded-full border border-red-300 bg-red-50 px-5 py-3 font-black text-red-700 transition hover:bg-red-600 hover:text-white"
                        >
                          Eliminar
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-2xl border-2 border-red-700 bg-red-700 p-5 text-white">
                  <p className="text-sm font-black uppercase text-white/80">
                    Total compra
                  </p>
                  <p className="mt-2 text-4xl font-black">
                    ${totalCompra.toLocaleString('es-CL')}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={confirmarCompra}
                  disabled={guardando}
                  className="rounded-full bg-red-700 px-8 py-4 font-black text-white shadow-lg transition hover:bg-red-800 disabled:opacity-50"
                >
                  {guardando
                    ? 'Guardando...'
                    : 'Confirmar compra e ingresar stock'}
                </button>

                <button
                  type="button"
                  onClick={limpiarFormulario}
                  className="rounded-full border border-gray-300 bg-gray-100 px-8 py-4 font-black text-gray-700 transition hover:bg-gray-200"
                >
                  Limpiar
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}