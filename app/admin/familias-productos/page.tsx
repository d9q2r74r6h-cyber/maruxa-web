'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';

type TipoMargen = 'markup' | 'margen_comercial';

type FamiliaProducto = {
  id: string;
  nombre: string;
  tipo_margen: TipoMargen;
  margen_porcentaje: number;
  redondeo_precio: number;
  activo: boolean;
  mostrar_catalogo: boolean;
};

const formInicial = {
  nombre: '',
  tipo_margen: 'markup' as TipoMargen,
  margen_porcentaje: '0',
  redondeo_precio: '10',
  activo: true,
  mostrar_catalogo: true,
};

export default function AdminFamiliasProductosPage() {
  const [familias, setFamilias] = useState<FamiliaProducto[]>([]);
  const [form, setForm] = useState(formInicial);
  const [editando, setEditando] = useState<FamiliaProducto | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  async function eliminarFamilia(familia: FamiliaProducto) {
    const confirmar = window.confirm(
      `¿Eliminar la familia "${familia.nombre}"?`
    );
  
    if (!confirmar) return;
  
    const { error } = await supabase
      .from('familias_productos')
      .delete()
      .eq('id', familia.id);
  
    if (error) {
      alert(error.message);
      return;
    }
  
    cargarFamilias();
  }

  async function cargarFamilias() {
    setLoading(true);

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('familias_productos')
      .select('id,nombre,tipo_margen,margen_porcentaje,redondeo_precio,activo,mostrar_catalogo')
      .eq('empresa_id', empresa.id)
      .order('nombre', { ascending: true });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setFamilias((data as FamiliaProducto[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    cargarFamilias();
  }, []);

  function limpiarFormulario() {
    setForm(formInicial);
    setEditando(null);
  }

  function editarFamilia(familia: FamiliaProducto) {
    setEditando(familia);
    setForm({
      nombre: familia.nombre || '',
      tipo_margen: familia.tipo_margen || 'markup',
      margen_porcentaje: String(familia.margen_porcentaje || 0),
      redondeo_precio: String(familia.redondeo_precio || 10),
      activo: familia.activo ?? true,
      mostrar_catalogo: familia.mostrar_catalogo ?? true,
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function guardarFamilia() {
    if (!form.nombre.trim()) {
      alert('Ingresa el nombre de la familia.');
      return;
    }

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      return;
    }

    setGuardando(true);

    const payload = {
      empresa_id: empresa.id,
      nombre: form.nombre.trim(),
      tipo_margen: form.tipo_margen,
      margen_porcentaje: Number(form.margen_porcentaje || 0),
      redondeo_precio: Number(form.redondeo_precio || 10),
      activo: form.activo,
      mostrar_catalogo: form.mostrar_catalogo,
    };

    const { error } = editando
      ? await supabase
          .from('familias_productos')
          .update(payload)
          .eq('id', editando.id)
          .eq('empresa_id', empresa.id)
      : await supabase.from('familias_productos').insert(payload);

    setGuardando(false);

    if (error) {
      alert(error.message);
      return;
    }

    limpiarFormulario();
    cargarFamilias();
  }

  async function cambiarEstado(familia: FamiliaProducto) {
    const { error } = await supabase
      .from('familias_productos')
      .update({ activo: !familia.activo })
      .eq('id', familia.id);

    if (error) {
      alert(error.message);
      return;
    }

    cargarFamilias();
  }

  return (
    <main className="min-h-screen bg-maruxa-crema px-5 py-12">
      <div className="mx-auto max-w-7xl">
        <p className="font-black uppercase tracking-[.24em] text-red-700">
          Configuración
        </p>

        <h1 className="mt-3 text-5xl font-black text-maruxa-chocolate">
          Familias de productos
        </h1>

        <section className="mt-10 rounded-[34px] bg-white p-6 shadow-premium">
          <h2 className="text-2xl font-black text-maruxa-chocolate">
            {editando ? 'Editar familia' : 'Nueva familia'}
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-4">
            <div className="rounded-2xl border bg-white p-4 md:col-span-2">
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-500">
                Nombre familia
              </label>

              <input
                value={form.nombre}
                onChange={(e) =>
                  setForm({ ...form, nombre: e.target.value })
                }
                placeholder="Ej: Tortas, Pan corriente, Pastelería"
                className="w-full bg-transparent text-lg font-black outline-none"
              />
            </div>

            <div className="rounded-2xl border bg-white p-4">
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-500">
                Tipo de margen
              </label>

              <select
                value={form.tipo_margen}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tipo_margen: e.target.value as TipoMargen,
                  })
                }
                className="w-full bg-transparent text-lg font-black outline-none"
              >
                <option value="markup">Markup sobre costo</option>
                <option value="margen_comercial">
                  Margen comercial sobre venta
                </option>
              </select>
            </div>

            <div className="rounded-2xl border bg-white p-4">
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-500">
                Margen %
              </label>

              <input
                type="number"
                value={form.margen_porcentaje}
                onChange={(e) =>
                  setForm({ ...form, margen_porcentaje: e.target.value })
                }
                className="w-full bg-transparent text-lg font-black outline-none"
              />
            </div>

            <div className="rounded-2xl border bg-white p-4">
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-500">
                Redondeo precio
              </label>

              <input
                type="number"
                value={form.redondeo_precio}
                onChange={(e) =>
                  setForm({ ...form, redondeo_precio: e.target.value })
                }
                placeholder="Ej: 10, 50, 100"
                className="w-full bg-transparent text-lg font-black outline-none"
              />
            </div>

            <label className="flex items-center gap-3 rounded-2xl bg-maruxa-crema p-4 font-black">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) =>
                  setForm({ ...form, activo: e.target.checked })
                }
              />
              Familia activa
            </label>

            <label className="flex items-center gap-3 rounded-2xl bg-maruxa-crema p-4 font-black">
              <input
                type="checkbox"
                checked={form.mostrar_catalogo}
                onChange={(e) =>
                  setForm({ ...form, mostrar_catalogo: e.target.checked })
                }
              />
              Mostrar en catalogo
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={guardarFamilia}
              disabled={guardando}
              className="rounded-full border-2 border-red-700 bg-red-700 px-8 py-4 font-black text-white shadow-lg transition hover:bg-red-800 disabled:opacity-50"
            >
              {guardando
                ? 'Guardando...'
                : editando
                  ? 'Guardar cambios'
                  : 'Guardar familia'}
            </button>

            <button
              type="button"
              onClick={limpiarFormulario}
              className="rounded-full border border-gray-300 bg-gray-100 px-8 py-4 font-black text-gray-700 transition hover:bg-gray-200"
            >
              Limpiar
            </button>
          </div>
        </section>

        <section className="mt-10 rounded-[34px] bg-white p-6 shadow-premium">
          <h2 className="text-2xl font-black text-maruxa-chocolate">
            Familias registradas
          </h2>

          {loading ? (
            <p className="mt-6 font-black">Cargando familias...</p>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-2xl border">
              <table className="w-full text-sm">
                <thead className="bg-red-700 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Familia</th>
                    <th className="px-4 py-3 text-left">Método</th>
                    <th className="px-4 py-3 text-right">Margen</th>
                    <th className="px-4 py-3 text-right">Redondeo</th>
                    <th className="px-4 py-3 text-center">Catalogo</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {familias.map((familia) => (
                    <tr
                      key={familia.id}
                      className="border-b last:border-none hover:bg-maruxa-crema/40"
                    >
                      <td
                        onClick={() => editarFamilia(familia)}
                        className="cursor-pointer px-4 py-4 font-black text-maruxa-chocolate"
                      >
                        {familia.nombre}
                      </td>

                      <td className="px-4 py-4 font-bold">
                        {familia.tipo_margen === 'markup'
                          ? 'Markup sobre costo'
                          : 'Margen comercial'}
                      </td>

                      <td className="px-4 py-4 text-right font-black">
                        {familia.margen_porcentaje.toLocaleString('es-CL')}%
                      </td>

                      <td className="px-4 py-4 text-right font-black">
                        ${familia.redondeo_precio.toLocaleString('es-CL')}
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            familia.mostrar_catalogo
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {familia.mostrar_catalogo ? 'Visible' : 'Oculta'}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            familia.activo
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {familia.activo ? 'Activa' : 'Inactiva'}
                          
                        </span>
                           
                      </td>
                      

                      <td className="px-4 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => editarFamilia(familia)}
                          className="rounded-full border border-blue-300 bg-blue-50 px-4 py-2 font-black text-blue-700 transition hover:bg-blue-600 hover:text-white"
                        >
                          Modificar
                        </button>

                        <button
                          type="button"
                          onClick={() => cambiarEstado(familia)}
                          className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 font-black text-amber-700 transition hover:bg-amber-500 hover:text-white"
                        >
                          {familia.activo ? 'Desactivar' : 'Activar'}
                        </button>

                        <button
                          type="button"
                          onClick={() => eliminarFamilia(familia)}
                          className="rounded-full border border-red-300 bg-red-50 px-4 py-2 font-black text-red-700 transition hover:bg-red-600 hover:text-white"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                    </tr>
                  ))}

                  {familias.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center font-black text-gray-500"
                      >
                        Aún no hay familias registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
