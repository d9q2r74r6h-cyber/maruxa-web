'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';

type Ingrediente = {
  id: string;
  nombre: string;
  categoria: string;
  unidad_base: string;
  costo_unitario: number;
  stock_actual: number;
  stock_minimo: number;
  es_harina: boolean;
  afecta_stock: boolean;
  afecta_costos: boolean;
  proveedor: string | null;
  activo: boolean;
  iva_porcentaje: number;
  impuesto_adicional_porcentaje: number;
};

const formInicial = {
  nombre: '',
  categoria: 'otro',
  unidad_base: 'kg',
  costo_unitario: '',
  stock_actual: '',
  stock_minimo: '',
  proveedor: '',
  es_harina: false,
  afecta_stock: true,
  afecta_costos: true,
  iva_porcentaje: 0,
  impuesto_adicional_porcentaje: 0,
};

export default function AdminIngredientesPage() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Ingrediente | null>(null);
  const [form, setForm] = useState(formInicial);

  const ingredientesFiltrados = useMemo(() => {
    return ingredientes.filter((item) => {
      const texto = `${item.nombre} ${item.categoria} ${item.proveedor || ''}`.toLowerCase();
      return texto.includes(busqueda.toLowerCase());
    });
  }, [ingredientes, busqueda]);

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
      .select('*')
      .eq('empresa_id', empresa.id)
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

  function limpiarFormulario() {
    setEditando(null);
    setForm(formInicial);
  }

  function editarIngrediente(item: Ingrediente) {
    setEditando(item);
    setForm({
      nombre: item.nombre || '',
      categoria: item.categoria || 'otro',
      unidad_base: item.unidad_base || 'kg',
      costo_unitario: String(item.costo_unitario || ''),
      stock_actual: String(item.stock_actual || ''),
      stock_minimo: String(item.stock_minimo || ''),
      proveedor: item.proveedor || '',
      es_harina: item.es_harina || false,
      afecta_stock: item.afecta_stock ?? true,
      afecta_costos: item.afecta_costos ?? true,
      iva_porcentaje: item.iva_porcentaje || 0,
      impuesto_adicional_porcentaje: item.impuesto_adicional_porcentaje || 0,
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function guardarIngrediente() {
    if (!form.nombre) {
      alert('Ingresa el nombre del ingrediente.');
      return;
    }

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      return;
    }

    const payload = {
        empresa_id: empresa.id,
        nombre: form.nombre,
        categoria: form.categoria,
        unidad_base: form.unidad_base,
        costo_unitario: Number(form.costo_unitario || 0),
        stock_minimo: Number(form.stock_minimo || 0),
        proveedor: form.proveedor || null,
        es_harina: form.es_harina,
        afecta_stock: form.afecta_stock,
        afecta_costos: form.afecta_costos,
        activo: true,
        iva_porcentaje: Number(form.iva_porcentaje || 0),
        impuesto_adicional_porcentaje: Number(
        form.impuesto_adicional_porcentaje || 0
),
      };

    const { error } = editando
      ? await supabase
          .from('ingredientes')
          .update(payload)
          .eq('id', editando.id)
          .eq('empresa_id', empresa.id)
      : await supabase.from('ingredientes').insert(payload);

    if (error) {
      alert(error.message);
      return;
    }

    limpiarFormulario();
    cargarIngredientes();
  }

  async function cambiarEstado(item: Ingrediente) {
    const { error } = await supabase
      .from('ingredientes')
      .update({ activo: !item.activo })
      .eq('id', item.id);

    if (error) {
      alert(error.message);
      return;
    }

    cargarIngredientes();
}

const costoNeto = Number(form.costo_unitario || 0);
const iva = Number(form.iva_porcentaje || 0);
const impuestoAdicional = Number(
  form.impuesto_adicional_porcentaje || 0
);

const montoIva = costoNeto * (iva / 100);
const montoImpuestoAdicional = costoNeto * (impuestoAdicional / 100);

const costoFinalConImpuestos =
  costoNeto + montoIva + montoImpuestoAdicional;

  return (
    <main className="min-h-screen bg-maruxa-crema px-5 py-12">
      <div className="mx-auto max-w-7xl">
        <p className="font-black uppercase tracking-[.24em] text-maruxa-rojo">
          Inventario
        </p>

        <h1 className="mt-3 text-5xl font-black text-maruxa-chocolate">
          Ingredientes
        </h1>

        <section className="mt-10 rounded-[34px] bg-white p-6 shadow-premium">
          <h2 className="text-2xl font-black text-maruxa-chocolate">
            {editando ? 'Editar ingrediente' : 'Nuevo ingrediente'}
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Nombre"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <input
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              placeholder="Categoría"
              className="rounded-2xl border px-5 py-4 font-bold"
            />

            <select
              value={form.unidad_base}
              onChange={(e) =>
                setForm({ ...form, unidad_base: e.target.value })
              }
              className="rounded-2xl border px-5 py-4 font-bold"
            >
              <option value="kg">Kg</option>
              <option value="g">Gramos</option>
              <option value="lt">Litros</option>
              <option value="cc">CC</option>
              <option value="ml">ML</option>
              <option value="un">Unidad</option>
              <option value="saco">Saco</option>
            </select>

            <input
              type="number"
              value={form.costo_unitario}
              onChange={(e) =>
                setForm({ ...form, costo_unitario: e.target.value })
              }
              placeholder="Costo unitario"
              className="rounded-2xl border px-5 py-4 font-bold"
            />
            <input
                type="number"
                value={form.iva_porcentaje}
                onChange={(e) =>
                    setForm({
                    ...form,
                    iva_porcentaje: Number(e.target.value || 0),
                    })
                }
                placeholder="IVA %"
                className="rounded-2xl border px-5 py-4 font-bold"
                />
<input
  type="number"
  value={form.impuesto_adicional_porcentaje}
  onChange={(e) =>
    setForm({
      ...form,
      impuesto_adicional_porcentaje: Number(e.target.value || 0),
    })
  }
  placeholder="Otro impuesto %"
  className="rounded-2xl border px-5 py-4 font-bold"
/>

            

            <input
              type="number"
              value={form.stock_minimo}
              onChange={(e) =>
                setForm({ ...form, stock_minimo: e.target.value })
              }
              placeholder="Stock mínimo"
              className="rounded-2xl border px-5 py-4 font-bold"
            />



            <input
              value={form.proveedor}
              onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
              placeholder="Proveedor"
              className="rounded-2xl border px-5 py-4 font-bold md:col-span-3"
            />

            
          </div>

          <div className="mt-5 rounded-2xl bg-maruxa-crema p-5">
  <h3 className="text-lg font-black text-maruxa-chocolate">
    Resumen de impuestos
  </h3>

  <div className="mt-3 grid gap-3 md:grid-cols-4">
    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs font-black uppercase text-gray-500">
        Costo neto
      </p>
      <p className="mt-1 text-2xl font-black text-maruxa-chocolate">
        ${costoNeto.toLocaleString('es-CL')}
      </p>
    </div>

    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs font-black uppercase text-gray-500">
        IVA {iva}%
      </p>
      <p className="mt-1 text-2xl font-black text-maruxa-chocolate">
        ${montoIva.toLocaleString('es-CL')}
      </p>
    </div>

    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs font-black uppercase text-gray-500">
        Impuesto adicional {impuestoAdicional}%
      </p>
      <p className="mt-1 text-2xl font-black text-maruxa-chocolate">
        ${montoImpuestoAdicional.toLocaleString('es-CL')}
      </p>
    </div>

    <div className="rounded-2xl border-2 border-red-700 bg-red-700 p-4 text-white">
      <p className="text-xs font-black uppercase text-white/80">
        Costo final
      </p>
      <p className="mt-1 text-2xl font-black">
        ${costoFinalConImpuestos.toLocaleString('es-CL')}
      </p>
    </div>
  </div>
</div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-3 rounded-2xl bg-maruxa-crema p-4 font-black">
              <input
                type="checkbox"
                checked={form.es_harina}
                onChange={(e) =>
                  setForm({ ...form, es_harina: e.target.checked })
                }
              />
              Es harina
            </label>

            <label className="flex items-center gap-3 rounded-2xl bg-maruxa-crema p-4 font-black">
              <input
                type="checkbox"
                checked={form.afecta_stock}
                onChange={(e) =>
                  setForm({ ...form, afecta_stock: e.target.checked })
                }
              />
              Afecta stock
            </label>

            <label className="flex items-center gap-3 rounded-2xl bg-maruxa-crema p-4 font-black">
              <input
                type="checkbox"
                checked={form.afecta_costos}
                onChange={(e) =>
                  setForm({ ...form, afecta_costos: e.target.checked })
                }
              />
              Afecta costos
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={guardarIngrediente}
              className="rounded-full bg-maruxa-rojo px-8 py-4 font-black text-white"
            >
              {editando ? 'Guardar cambios' : 'Guardar ingrediente'}
            </button>

            <button
              type="button"
              onClick={limpiarFormulario}
              className="rounded-full bg-gray-200 px-8 py-4 font-black text-black"
            >
              Limpiar
            </button>
          </div>
        </section>

        <section className="mt-10 rounded-[34px] bg-white p-6 shadow-premium">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <h2 className="text-2xl font-black text-maruxa-chocolate">
              Lista de ingredientes
            </h2>

            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar ingrediente..."
              className="rounded-2xl border px-5 py-4 font-bold"
            />
          </div>

          {loading ? (
            <p className="mt-6 font-black">Cargando ingredientes...</p>
          ) : (
            <div className="mt-6 grid gap-3">
              {ingredientesFiltrados.map((item) => {
                const stockBajo =
                  item.afecta_stock && item.stock_actual <= item.stock_minimo;

                return (
                  <article
                    key={item.id}
                    onClick={() => editarIngrediente(item)}
                    className={`cursor-pointer rounded-[24px] p-5 shadow-premium transition hover:-translate-y-1 ${
                      item.activo ? 'bg-maruxa-crema' : 'bg-gray-100 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-maruxa-rojo">
                          {item.categoria}
                        </p>

                        <h3 className="mt-1 text-2xl font-black text-maruxa-chocolate">
                          {item.nombre}
                        </h3>

                        <p className="mt-1 text-sm font-bold text-maruxa-cafe/70">
                          Unidad: {item.unidad_base} · Proveedor:{' '}
                          {item.proveedor || 'Sin proveedor'}
                        </p>

                        {stockBajo && (
                          <p className="mt-2 font-black text-red-600">
                            Stock bajo
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                      {(() => {
                        const costoNetoItem = Number(item.costo_unitario || 0);
                        const ivaItem = Number(item.iva_porcentaje || 0);
                        const impuestoItem = Number(item.impuesto_adicional_porcentaje || 0);

                        const costoFinalItem =
                            costoNetoItem * (1 + ivaItem / 100 + impuestoItem / 100);

                        return (
                            <>
                            <p className="font-black text-maruxa-vino">
                                Neto: ${costoNetoItem.toLocaleString('es-CL')}
                            </p>

                            <p className="mt-1 text-sm font-black text-red-700">
                                Final: ${costoFinalItem.toLocaleString('es-CL')}
                            </p>

                            <p className="mt-1 text-xs font-bold text-gray-600">
                                IVA {ivaItem}% · Otro {impuestoItem}%
                            </p>
                            </>
                        );
                        })()}

                        <p className="mt-1 text-sm font-bold">
                          Stock: {item.stock_actual} / mínimo{' '}
                          {item.stock_minimo}
                        </p>

                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          {item.es_harina && (
                            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-black text-yellow-800">
                              Harina
                            </span>
                          )}

                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black">
                            {item.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          cambiarEstado(item);
                        }}
                        className="rounded-full bg-white px-5 py-3 text-sm font-black"
                      >
                        {item.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}