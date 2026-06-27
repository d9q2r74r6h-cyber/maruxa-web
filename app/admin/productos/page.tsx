'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';
import { Search, X } from 'lucide-react';
type TipoProducto = 'producto' | 'ingrediente' | 'envase' | 'mano_obra';

type Producto = {
  id: number;
  codigo: string | null;
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
  familia_id: string | null;
  tipo_producto: TipoProducto | null;
  unidad_base: string | null;
  costo_unitario: number | null;
  iva_porcentaje: number | null;
  impuesto_adicional_porcentaje: number | null;
  impuesto_adicional_id?: string | null;
  stock_actual: number | null;
  stock_minimo: number | null;
  activo: boolean | null;
  controla_stock: boolean | null;
  contabiliza_como_saco: boolean | null;
  familias_productos?: {
    nombre: string;
    mostrar_catalogo: boolean | null;
  } | null;
  usar_configuracion_familia: boolean | null;
  margen_personalizado: number | null;
  tipo_margen_personalizado: 'markup' | 'margen_comercial' | null;
  redondeo_personalizado: number | null;
};

const formInicial = {
  codigo: '',
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

  familia_id: '',
  usar_configuracion_familia: true,
  margen_personalizado: '',
  tipo_margen_personalizado: 'markup' as 'markup' | 'margen_comercial',
  redondeo_personalizado: '',

  tipo_producto: 'producto' as TipoProducto,
  unidad_base: 'KG',
  costo_unitario: '',
  iva_porcentaje: '19',
  impuesto_adicional_porcentaje: '',
  impuesto_adicional_id: '',
  stock_actual: '',
  stock_minimo: '',
  activo: true,
  controla_stock: true,
  contabiliza_como_saco: false,
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

function normalizarTexto(texto: string | null | undefined) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function numero(valor: string | number | null | undefined) {
  return Number(String(valor ?? '').replace(',', '.')) || 0;
}

function dinero(valor: number) {
  return `$${Math.round(valor || 0).toLocaleString('es-CL')}`;
}

type ImpuestoAdicional = {
  id: string;
  nombre: string;
  porcentaje: number;
};

export default function AdminProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoProducto>('todos');

  const [productoEditando, setProductoEditando] =
    useState<Producto | null>(null);

  const [familias, setFamilias] = useState<
    {
      id: string;
      nombre: string;
      mostrar_catalogo: boolean | null;
    }[]
  >([]);
  const [impuestosAdicionales, setImpuestosAdicionales] = useState<
    ImpuestoAdicional[]
  >([]);
  const [ivaEmpresa, setIvaEmpresa] = useState(19);

  const [form, setForm] = useState(formInicial);

  const totalProductos = useMemo(() => productos.length, [productos]);
  const productosFiltrados = useMemo(() => {
    const termino = normalizarTexto(busqueda.trim());

    return productos.filter((producto) => {
      const tipo = producto.tipo_producto || 'producto';
      const coincideTipo = filtroTipo === 'todos' || tipo === filtroTipo;
      if (!coincideTipo) return false;
      if (!termino) return true;

      const contenido = [
        producto.codigo,
        producto.nombre,
        producto.descripcion,
        producto.categoria,
        producto.familias_productos?.nombre,
        tipo,
      ]
        .map(normalizarTexto)
        .join(' ');

      return contenido.includes(termino);
    });
  }, [productos, busqueda, filtroTipo]);

  const esProducto = form.tipo_producto === 'producto';
  const esInsumo = form.tipo_producto !== 'producto';
  const esManoObra = form.tipo_producto === 'mano_obra';
  const ivaProducto = ivaEmpresa;
  const precioVentaFinal = numero(form.precio);
  const precioVentaNeto =
    precioVentaFinal > 0 ? precioVentaFinal / (1 + ivaProducto / 100) : 0;
  const ivaVentaCalculado =
    precioVentaFinal > 0 ? precioVentaFinal - precioVentaNeto : 0;
  const impuestoSeleccionado = impuestosAdicionales.find(
    (impuesto) => impuesto.id === form.impuesto_adicional_id
  );
  const familiaFormSeleccionada = familias.find(
    (familia) => familia.id === form.familia_id
  );

  async function cargarProductos() {
    setCargando(true);

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      setCargando(false);
      return;
    }

    setIvaEmpresa(numero(empresa.iva_porcentaje ?? 19) || 19);

    const { data, error } = await supabase
      .from('productos')
      .select(`
        *,
        familias_productos (
          nombre,
          mostrar_catalogo
        )
      `)
      .eq('empresa_id', empresa.id)
      .order('id', { ascending: false });

    if (error) {
      alert(error.message);
      setCargando(false);
      return;
    }

    setProductos((data as Producto[]) || []);
    setCargando(false);
  }

  async function subirImagenProducto(file: File) {
    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa para subir la imagen.');
      return;
    }

    const extension = file.name.split('.').pop() ?? 'jpg';
    const nombreBase = crearSlug(file.name.replace(/\.[^/.]+$/, ''));
    const nombreArchivo = `${empresa.id}/${Date.now()}-${nombreBase}.${extension}`;

    const { error } = await supabase.storage
      .from('productos')
      .upload(nombreArchivo, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      alert(error.message);
      return;
    }

    const { data } = supabase.storage
      .from('productos')
      .getPublicUrl(nombreArchivo);

    setForm({
      ...form,
      imagen: data.publicUrl,
    });
  }

  async function cargarFamilias() {
    const empresa = await obtenerEmpresaActual();

    if (!empresa) return;

    const { data } = await supabase
      .from('familias_productos')
      .select('id,nombre,mostrar_catalogo')
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('nombre');

    setFamilias(data || []);
  }

  async function cargarImpuestosAdicionales() {
    const empresa = await obtenerEmpresaActual();

    if (!empresa) return;

    const { data } = await supabase
      .from('impuestos_adicionales')
      .select('id, nombre, porcentaje')
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('nombre', { ascending: true });

    setImpuestosAdicionales((data as ImpuestoAdicional[]) || []);
  }

  useEffect(() => {
    cargarProductos();
    cargarFamilias();
    cargarImpuestosAdicionales();
  }, []);

  function limpiarFormulario() {
    setProductoEditando(null);
    setForm(formInicial);
  }

  function editarProducto(producto: Producto) {
    setProductoEditando(producto);

    const tipoProducto = producto.tipo_producto || 'producto';

    setForm({
      codigo: producto.codigo || '',
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      precio: String(producto.precio || ''),
      categoria: producto.categoria || 'Panadería',
      imagen: producto.imagen || '',
      destacado: producto.destacado,
      precio_10: String(producto.precio_10 || ''),
      precio_15: String(producto.precio_15 || ''),
      precio_20: String(producto.precio_20 || ''),
      precio_25: String(producto.precio_25 || ''),
      familia_id: producto.familia_id || '',
      usar_configuracion_familia:
        producto.usar_configuracion_familia ?? true,
      margen_personalizado: String(
        producto.margen_personalizado || ''
      ),
      tipo_margen_personalizado:
        producto.tipo_margen_personalizado || 'markup',
      redondeo_personalizado: String(
        producto.redondeo_personalizado || ''
      ),

      tipo_producto: tipoProducto,
      unidad_base: producto.unidad_base || 'KG',
      costo_unitario: String(producto.costo_unitario || ''),
      iva_porcentaje: String(ivaEmpresa || producto.iva_porcentaje || 19),
      impuesto_adicional_porcentaje: String(
        producto.impuesto_adicional_porcentaje || ''
      ),
      impuesto_adicional_id: producto.impuesto_adicional_id || '',
      stock_actual: String(producto.stock_actual || ''),
      stock_minimo: String(producto.stock_minimo || ''),
      activo: producto.activo ?? true,
      controla_stock: producto.controla_stock ?? tipoProducto !== 'mano_obra',
      contabiliza_como_saco: producto.contabiliza_como_saco ?? false,
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function validarFormulario() {
    if (!form.nombre) {
      alert('Ingresa el nombre.');
      return false;
    }

    if (esProducto && !form.familia_id) {
      alert('Selecciona una familia para el producto.');
      return false;
    }

    if (esProducto && !form.categoria) {
      alert('Completa la categoría.');
      return false;
    }

    if (
      esProducto &&
      form.categoria !== 'Tortas' &&
      !form.precio
    ) {
      alert('Completa el precio de venta.');
      return false;
    }

    if (
      esProducto &&
      form.categoria === 'Tortas' &&
      !form.precio_10 &&
      !form.precio_15 &&
      !form.precio_20 &&
      !form.precio_25
    ) {
      alert('Completa al menos un precio de torta.');
      return false;
    }

    if (esInsumo && !form.costo_unitario) {
      alert('Ingresa el costo unitario.');
      return false;
    }

    return true;
  }

  function construirDatosProducto(empresaId?: string | number) {
    return {
      codigo: form.codigo.trim() || null,
      nombre: form.nombre,
      descripcion: form.descripcion,
      precio:
        form.tipo_producto === 'producto'
          ? form.categoria === 'Tortas'
            ? Number(form.precio_10 || 0)
            : Number(form.precio || 0)
          : 0,
      categoria:
        form.tipo_producto === 'producto'
          ? form.categoria
          : form.tipo_producto === 'ingrediente'
            ? 'Ingredientes'
            : form.tipo_producto === 'envase'
              ? 'Envases'
              : 'Mano de obra',
      empresa_id: empresaId,
      imagen: esProducto ? form.imagen || null : null,
      destacado: esProducto ? form.destacado : false,
      slug: crearSlug(form.nombre),

      precio_10:
        esProducto && form.precio_10 ? Number(form.precio_10) : null,
      precio_15:
        esProducto && form.precio_15 ? Number(form.precio_15) : null,
      precio_20:
        esProducto && form.precio_20 ? Number(form.precio_20) : null,
      precio_25:
        esProducto && form.precio_25 ? Number(form.precio_25) : null,

      familia_id: esProducto ? form.familia_id || null : null,
      usar_configuracion_familia: esProducto
        ? form.usar_configuracion_familia
        : true,
      margen_personalizado:
        esProducto && !form.usar_configuracion_familia
          ? Number(form.margen_personalizado || 0)
          : null,
      tipo_margen_personalizado:
        esProducto && !form.usar_configuracion_familia
          ? form.tipo_margen_personalizado
          : null,
      redondeo_personalizado:
        esProducto && !form.usar_configuracion_familia
          ? Number(form.redondeo_personalizado || 0)
          : null,

      tipo_producto: form.tipo_producto,
      unidad_base: form.unidad_base,
      costo_unitario: Number(form.costo_unitario || 0),
      iva_porcentaje: ivaEmpresa,
      impuesto_adicional_id: impuestoSeleccionado?.id || null,
      impuesto_adicional_porcentaje: impuestoSeleccionado
        ? Number(impuestoSeleccionado.porcentaje || 0)
        : 0,
      stock_actual: Number(form.stock_actual || 0),
      stock_minimo: Number(form.stock_minimo || 0),
      controla_stock:
        form.tipo_producto === 'mano_obra'
          ? false
          : form.controla_stock,
      contabiliza_como_saco:
        form.tipo_producto === 'ingrediente'
          ? form.contabiliza_como_saco
          : false,
      activo: form.activo,
    };
  }

  async function crearProducto() {
    if (!validarFormulario()) return;

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      return;
    }

    const { error } = await supabase
      .from('productos')
      .insert(construirDatosProducto(empresa.id));

    if (error) {
      alert(error.message);
      return;
    }

    limpiarFormulario();
    cargarProductos();
  }

  async function guardarCambios() {
    if (!productoEditando) return;
    if (!validarFormulario()) return;

    const datos = construirDatosProducto();
    delete datos.empresa_id;

    const { error } = await supabase
      .from('productos')
      .update(datos)
      .eq('id', productoEditando.id);

    if (error) {
      alert(error.message);
      return;
    }

    limpiarFormulario();
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
            {productoEditando ? 'Editar producto' : 'Crear producto'}
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input
              placeholder="Codigo de producto"
              value={form.codigo}
              onChange={(e) =>
                setForm({
                  ...form,
                  codigo: e.target.value,
                })
              }
              className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold uppercase outline-none"
            />

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

            <select
              value={form.tipo_producto}
              onChange={(e) =>
                setForm({
                  ...form,
                  tipo_producto: e.target.value as TipoProducto,
                })
              }
              className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
            >
              <option value="producto">Producto terminado</option>
              <option value="ingrediente">Ingrediente</option>
              <option value="envase">Envase</option>
              <option value="mano_obra">Mano de obra</option>
            </select>

            {esProducto && (
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
            )}

            {esProducto && form.categoria !== 'Tortas' && (
              <label className="space-y-2">
                <span className="block text-xs font-black uppercase tracking-wide text-maruxa-cafe/60">
                  Precio de venta final
                </span>
                <input
                  placeholder="Precio con IVA incluido"
                  type="number"
                  value={form.precio}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      precio: e.target.value,
                    })
                  }
                  className="h-14 w-full rounded-2xl border border-maruxa-rojo/10 px-5 font-bold outline-none"
                />
                <span className="block text-xs font-semibold text-maruxa-cafe/60">
                  Ingrese el precio que paga el cliente. Neto aprox:{' '}
                  {dinero(precioVentaNeto)} | IVA:{' '}
                  {dinero(ivaVentaCalculado)}
                </span>
              </label>
            )}

            <div className="md:col-span-2 mt-2 rounded-[24px] border border-maruxa-rojo/10 bg-maruxa-crema/60 p-4">
              <h3 className="text-lg font-black text-maruxa-chocolate">
                Datos operacionales
              </h3>

              <p className="mt-1 text-sm font-bold text-maruxa-cafe/70">
                Unidad, costo, impuestos e inventario usados en compras, recetas y produccion.
              </p>
            </div>

            <>
                <label className="space-y-2">
                  <span className="block text-xs font-black uppercase tracking-wide text-maruxa-cafe/60">
                    Unidad base
                  </span>
                  <select
                  value={form.unidad_base}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      unidad_base: e.target.value,
                    })
                  }
                  className="h-14 w-full rounded-2xl border border-maruxa-rojo/10 px-5 font-bold outline-none"
                >
                  <option value="KG">KG</option>
                  <option value="LT">LT</option>
                  <option value="UN">UN</option>
                  <option value="GR">GR</option>
                  <option value="ML">ML</option>
                  <option value="CC">CC</option>
                  <option value="MIN">MIN</option>
                </select>
                  <span className="block text-xs font-semibold text-maruxa-cafe/60">
                    Como se mide en compras, recetas e inventario.
                  </span>
                </label>

                <label className="space-y-2">
                  <span className="block text-xs font-black uppercase tracking-wide text-maruxa-cafe/60">
                    {esProducto ? 'Costo base o reposicion' : 'Costo unitario neto'}
                  </span>
                  <input
                    placeholder={esProducto ? 'Ej: 850' : 'Ej: 1250'}
                    type="number"
                    value={form.costo_unitario}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        costo_unitario: e.target.value,
                      })
                    }
                    className="h-14 w-full rounded-2xl border border-maruxa-rojo/10 px-5 font-bold outline-none"
                  />
                  <span className="block text-xs font-semibold text-maruxa-cafe/60">
                    Se guarda sin IVA y alimenta compras, recetas y costeo.
                  </span>
                </label>

                <div className="rounded-2xl border border-maruxa-rojo/10 bg-maruxa-crema/60 px-5 py-4">
                  <span className="block text-xs font-black uppercase tracking-wide text-maruxa-cafe/60">
                    IVA general empresa
                  </span>
                  <p className="mt-2 text-2xl font-black text-maruxa-chocolate">
                    {ivaEmpresa.toLocaleString('es-CL')}%
                  </p>
                  <p className="mt-1 text-xs font-semibold text-maruxa-cafe/60">
                    Se configura una sola vez en Empresa y se aplica a este producto.
                  </p>
                </div>

                <label className="space-y-2">
                  <span className="block text-xs font-black uppercase tracking-wide text-maruxa-cafe/60">
                    Impuesto adicional
                  </span>
                  <select
                    value={form.impuesto_adicional_id}
                    onChange={(e) => {
                      const impuesto = impuestosAdicionales.find(
                        (item) => item.id === e.target.value
                      );

                      setForm({
                        ...form,
                        impuesto_adicional_id: e.target.value,
                        impuesto_adicional_porcentaje: impuesto
                          ? String(impuesto.porcentaje)
                          : '',
                      });
                    }}
                    className="h-14 w-full rounded-2xl border border-maruxa-rojo/10 px-5 font-bold outline-none"
                  >
                    <option value="">Sin impuesto adicional</option>
                    {impuestosAdicionales.map((impuesto) => (
                      <option key={impuesto.id} value={impuesto.id}>
                        {impuesto.nombre} ({Number(impuesto.porcentaje).toLocaleString('es-CL')}%)
                      </option>
                    ))}
                  </select>
                  <span className="block text-xs font-semibold text-maruxa-cafe/60">
                    Se configura en Empresa y aqui solo se selecciona si aplica.
                  </span>
                </label>

                <label className="space-y-2">
                  <span className="block text-xs font-black uppercase tracking-wide text-maruxa-cafe/60">
                    Stock inicial
                  </span>
                  <input
                    placeholder={esManoObra ? 'No aplica' : 'Ej: 25'}
                    type="number"
                    value={form.stock_actual}
                    disabled={esManoObra}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        stock_actual: e.target.value,
                      })
                    }
                    className="h-14 w-full rounded-2xl border border-maruxa-rojo/10 px-5 font-bold outline-none disabled:bg-gray-100 disabled:text-gray-400"
                  />
                  <span className="block text-xs font-semibold text-maruxa-cafe/60">
                    Existencia actual expresada en la unidad base.
                  </span>
                </label>

                <label className="space-y-2">
                  <span className="block text-xs font-black uppercase tracking-wide text-maruxa-cafe/60">
                    Stock minimo
                  </span>
                  <input
                    placeholder={esManoObra ? 'No aplica' : 'Ej: 5'}
                    type="number"
                    value={form.stock_minimo}
                    disabled={esManoObra}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        stock_minimo: e.target.value,
                      })
                    }
                    className="h-14 w-full rounded-2xl border border-maruxa-rojo/10 px-5 font-bold outline-none disabled:bg-gray-100 disabled:text-gray-400"
                  />
                  <span className="block text-xs font-semibold text-maruxa-cafe/60">
                    Punto de alerta para reponer inventario.
                  </span>
                </label>
              </>

            {esProducto && (
              <label className="space-y-2">
                <span className="block text-xs font-black uppercase tracking-wide text-maruxa-cafe/60">
                  Familia de costeo / margen
                </span>
                <select
                  value={form.familia_id ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      familia_id: e.target.value,
                    })
                  }
                  className="h-14 w-full rounded-2xl border border-maruxa-rojo/10 px-5 font-bold outline-none"
                >
                  <option value="">Seleccionar familia</option>

                  {familias.map((familia) => (
                    <option key={familia.id} value={familia.id}>
                      {familia.nombre}
                      {familia.mostrar_catalogo ? ' - Catalogo' : ' - Interna'}
                    </option>
                  ))}
                </select>
                {familiaFormSeleccionada && (
                  <span className="block text-xs font-semibold text-maruxa-cafe/60">
                    Esta familia{' '}
                    {familiaFormSeleccionada.mostrar_catalogo
                      ? 'se muestra en el catalogo publico.'
                      : 'queda solo para uso interno.'}
                  </span>
                )}
              </label>
            )}

            {esProducto && (
              <label className="flex items-center gap-3 font-black text-maruxa-chocolate">
                <input
                  type="checkbox"
                  checked={form.usar_configuracion_familia}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      usar_configuracion_familia: e.target.checked,
                    })
                  }
                />
                Usar configuración de la familia
              </label>
            )}

            {esProducto && form.categoria === 'Tortas' && (
              <>
                <label className="space-y-2">
                  <span className="block text-xs font-black uppercase tracking-wide text-maruxa-cafe/60">
                    Precio final 10 personas
                  </span>
                  <input
                    placeholder="Con IVA incluido"
                    type="number"
                    value={form.precio_10}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        precio_10: e.target.value,
                      })
                    }
                    className="h-14 w-full rounded-2xl border border-maruxa-rojo/10 px-5 font-bold outline-none"
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-xs font-black uppercase tracking-wide text-maruxa-cafe/60">
                    Precio final 15 personas
                  </span>
                  <input
                    placeholder="Con IVA incluido"
                    type="number"
                    value={form.precio_15}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        precio_15: e.target.value,
                      })
                    }
                    className="h-14 w-full rounded-2xl border border-maruxa-rojo/10 px-5 font-bold outline-none"
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-xs font-black uppercase tracking-wide text-maruxa-cafe/60">
                    Precio final 20 personas
                  </span>
                  <input
                    placeholder="Con IVA incluido"
                    type="number"
                    value={form.precio_20}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        precio_20: e.target.value,
                      })
                    }
                    className="h-14 w-full rounded-2xl border border-maruxa-rojo/10 px-5 font-bold outline-none"
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-xs font-black uppercase tracking-wide text-maruxa-cafe/60">
                    Precio final 25 personas
                  </span>
                  <input
                    placeholder="Con IVA incluido"
                    type="number"
                    value={form.precio_25}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        precio_25: e.target.value,
                      })
                    }
                    className="h-14 w-full rounded-2xl border border-maruxa-rojo/10 px-5 font-bold outline-none"
                  />
                </label>
                <p className="md:col-span-2 text-xs font-semibold text-maruxa-cafe/60">
                  Los precios de torta tambien son finales, con IVA incluido.
                </p>
              </>
            )}

              {form.tipo_producto === 'producto' && (
                <div className="rounded-2xl border border-maruxa-rojo/10 p-4 md:col-span-2">
                  <label className="mb-3 block text-xs font-black uppercase tracking-wide text-gray-500">
                    Imagen del producto
                  </label>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) subirImagenProducto(file);
                    }}
                    className="w-full rounded-2xl border px-4 py-3 font-bold"
                  />

                  {form.imagen && (
                    <img
                      src={form.imagen}
                      alt={form.nombre}
                      className="mt-4 h-40 w-full rounded-2xl object-cover"
                    />
                  )}
                </div>
              )}

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

            {esProducto && (
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
            )}

            <label className="flex items-center gap-3 font-black text-maruxa-chocolate">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) =>
                  setForm({
                    ...form,
                    activo: e.target.checked,
                  })
                }
              />
              Activo
            </label>

            <label className="flex items-center gap-3 font-black text-maruxa-chocolate">
              <input
                type="checkbox"
                checked={form.tipo_producto === 'mano_obra' ? false : form.controla_stock}
                disabled={form.tipo_producto === 'mano_obra'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    controla_stock: e.target.checked,
                  })
                }
              />
              Controla stock
            </label>

            {form.tipo_producto === 'ingrediente' && (
              <label className="flex items-center gap-3 font-black text-maruxa-chocolate">
                <input
                  type="checkbox"
                  checked={form.contabiliza_como_saco}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      contabiliza_como_saco: e.target.checked,
                    })
                  }
                />
                Usar en planilla de rinde
              </label>
            )}

            {esProducto && !form.usar_configuracion_familia && (
              <>
                <select
                  value={form.tipo_margen_personalizado}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tipo_margen_personalizado: e.target.value as
                        | 'markup'
                        | 'margen_comercial',
                    })
                  }
                  className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
                >
                  <option value="markup">Markup sobre costo</option>
                  <option value="margen_comercial">
                    Margen comercial sobre venta
                  </option>
                </select>

                <input
                  type="number"
                  placeholder="Margen personalizado %"
                  value={form.margen_personalizado}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      margen_personalizado: e.target.value,
                    })
                  }
                  className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
                />

                <input
                  type="number"
                  placeholder="Redondeo personalizado"
                  value={form.redondeo_personalizado}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      redondeo_personalizado: e.target.value,
                    })
                  }
                  className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
                />
              </>
            )}

            <div className="md:col-span-2 mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={
                  productoEditando ? guardarCambios : crearProducto
                }
                className="rounded-full bg-yellow-400 px-8 py-4 font-black text-black shadow-lg"
              >
                {productoEditando
                  ? 'Guardar cambios'
                  : 'Guardar producto'}
              </button>

              <button
                type="button"
                onClick={limpiarFormulario}
                className="rounded-full border border-black/10 bg-gray-200 px-8 py-4 font-black text-black"
              >
                Limpiar formulario
              </button>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 border-y border-maruxa-cafe/10 bg-white px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-maruxa-rojo">
                  Catálogo interno
                </p>
                <h2 className="mt-1 text-2xl font-black text-maruxa-chocolate">
                  Productos e insumos
                </h2>
                <p className="mt-1 text-sm font-bold text-maruxa-cafe/60">
                  {productosFiltrados.length} de {totalProductos} registros
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(260px,420px)_180px]">
                <label className="relative block">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-maruxa-cafe/45" />
                  <input
                    value={busqueda}
                    onChange={(event) => setBusqueda(event.target.value)}
                    placeholder="Buscar por nombre, código o categoría"
                    className="h-11 w-full rounded-md border border-maruxa-cafe/20 bg-white pl-10 pr-10 text-sm font-bold outline-none transition focus:border-maruxa-rojo"
                  />
                  {busqueda && (
                    <button
                      type="button"
                      onClick={() => setBusqueda('')}
                      title="Limpiar búsqueda"
                      className="absolute right-2 top-2 grid h-7 w-7 place-items-center text-maruxa-cafe/50 hover:text-maruxa-rojo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </label>

                <select
                  value={filtroTipo}
                  onChange={(event) =>
                    setFiltroTipo(event.target.value as 'todos' | TipoProducto)
                  }
                  className="h-11 rounded-md border border-maruxa-cafe/20 bg-white px-3 text-sm font-black text-maruxa-chocolate outline-none focus:border-maruxa-rojo"
                >
                  <option value="todos">Todos los tipos</option>
                  <option value="producto">Productos terminados</option>
                  <option value="ingrediente">Ingredientes</option>
                  <option value="envase">Envases</option>
                  <option value="mano_obra">Mano de obra</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
          {cargando && (
            <div className="rounded-2xl bg-white p-4 font-black shadow-premium">
              Cargando productos...
            </div>
          )}

          {!cargando && productosFiltrados.length === 0 && (
            <div className="border border-dashed border-maruxa-cafe/25 bg-white px-6 py-12 text-center">
              <Search className="mx-auto h-8 w-8 text-maruxa-cafe/35" />
              <p className="mt-3 font-black text-maruxa-chocolate">
                No encontramos coincidencias
              </p>
              <p className="mt-1 text-sm font-bold text-maruxa-cafe/55">
                Prueba otro nombre, código, categoría o tipo.
              </p>
            </div>
          )}

          {productosFiltrados.map((producto) => {
            const tipo = producto.tipo_producto || 'producto';
            const esInsumoLista = tipo !== 'producto';

            return (
              <article
                key={producto.id}
                onClick={() => editarProducto(producto)}
                className="cursor-pointer rounded-2xl bg-white px-4 py-3 shadow-premium transition hover:-translate-y-0.5 hover:ring-2 hover:ring-maruxa-rojo/20"
              >
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-maruxa-rojo/10 bg-maruxa-crema">
                      {producto.imagen ? (
                        <img
                          src={producto.imagen}
                          alt={producto.nombre}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-lg font-black uppercase text-maruxa-cafe/45">
                          {producto.nombre?.charAt(0) || 'P'}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-widest text-maruxa-rojo">
                      {tipo === 'producto'
                        ? producto.categoria
                        : tipo === 'ingrediente'
                          ? 'Ingrediente'
                          : tipo === 'envase'
                            ? 'Envase'
                            : 'Mano de obra'}
                    </p>

                    {tipo === 'producto' &&
                      producto.familias_productos?.nombre && (
                        <span className="mt-1 inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-black text-purple-700">
                          📂 {producto.familias_productos?.nombre}
                        </span>
                      )}

                    {tipo === 'producto' &&
                      producto.familias_productos?.nombre && (
                        <span
                          className={`mt-1 ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-black ${
                            producto.familias_productos?.mostrar_catalogo
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {producto.familias_productos?.mostrar_catalogo
                            ? 'Catalogo'
                            : 'Interno'}
                        </span>
                      )}

                    {tipo === 'producto' &&
                      !producto.usar_configuracion_familia && (
                        <span className="mt-1 ml-2 inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs font-black text-orange-700">
                          Margen personalizado
                        </span>
                      )}

                    {!producto.activo && (
                      <span className="mt-1 ml-2 inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs font-black text-gray-700">
                        Inactivo
                      </span>
                    )}

                    <span
                      className={`mt-1 ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-black ${
                        producto.controla_stock
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {producto.controla_stock ? 'Controla stock' : 'No controla stock'}
                    </span>

                    <h3 className="mt-1 text-xl font-black text-maruxa-chocolate">
                      {producto.nombre}
                    </h3>

                    {producto.codigo && (
                      <p className="mt-0.5 text-xs font-black uppercase tracking-wide text-maruxa-cafe/55">
                        Codigo: {producto.codigo}
                      </p>
                    )}

                    {esInsumoLista ? (
                      <p className="mt-1 font-bold text-maruxa-cafe/70">
                        Costo:{' '}
                        ${Math.round(
                          Number(producto.costo_unitario || 0)
                        ).toLocaleString('es-CL')}{' '}
                        / {producto.unidad_base || '-'}
                      </p>
                    ) : producto.categoria === 'Tortas' ? (
                      <div className="mt-1 text-sm font-bold text-maruxa-cafe/70">
                        <p>
                          10p: $
                          {producto.precio_10?.toLocaleString('es-CL') ||
                            '—'}
                        </p>
                        <p>
                          15p: $
                          {producto.precio_15?.toLocaleString('es-CL') ||
                            '—'}
                        </p>
                        <p>
                          20p: $
                          {producto.precio_20?.toLocaleString('es-CL') ||
                            '—'}
                        </p>
                        <p>
                          25p: $
                          {producto.precio_25?.toLocaleString('es-CL') ||
                            '—'}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 font-bold text-maruxa-cafe/70">
                        ${producto.precio.toLocaleString('es-CL')}
                      </p>
                    )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {tipo === 'producto' && (
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
                    )}

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
            );
          })}
          </div>
        </section>
      </div>
    </main>
  );
}
