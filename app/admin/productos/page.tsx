'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';
import { AdminMenu } from '@/components/AdminMenu';
type TipoProducto = 'producto' | 'ingrediente' | 'envase';

type Producto = {
  id: number;
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
  stock_actual: number | null;
  stock_minimo: number | null;
  activo: boolean | null;
  familias_productos?: {
    nombre: string;
  } | null;
  usar_configuracion_familia: boolean | null;
  margen_personalizado: number | null;
  tipo_margen_personalizado: 'markup' | 'margen_comercial' | null;
  redondeo_personalizado: number | null;
};

const CLAVE_ADMIN = 'maruxa1962';

const formInicial = {
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
  impuesto_adicional_porcentaje: '0',
  stock_actual: '0',
  stock_minimo: '0',
  activo: true,
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

export default function AdminProductosPage() {
  const [clave, setClave] = useState('');
  const [autorizado, setAutorizado] = useState(false);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(false);

  const [productoEditando, setProductoEditando] =
    useState<Producto | null>(null);

  const [imagenesStorage, setImagenesStorage] = useState<
    { nombre: string; url: string }[]
  >([]);

  const [familias, setFamilias] = useState<
    {
      id: string;
      nombre: string;
    }[]
  >([]);

  const [form, setForm] = useState(formInicial);

  const totalProductos = useMemo(() => productos.length, [productos]);

  const esProducto = form.tipo_producto === 'producto';
  const esInsumo =
    form.tipo_producto === 'ingrediente' ||
    form.tipo_producto === 'envase';

  async function cargarProductos() {
    setCargando(true);

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      setCargando(false);
      return;
    }

    const { data, error } = await supabase
      .from('productos')
      .select(`
        *,
        familias_productos (
          nombre
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

  async function cargarFamilias() {
    const empresa = await obtenerEmpresaActual();

    if (!empresa) return;

    const { data } = await supabase
      .from('familias_productos')
      .select('id,nombre')
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('nombre');

    setFamilias(data || []);
  }

  async function cargarImagenesStorage() {
    const carpetas = ['', 'productos', 'imagenes', 'public'];
    const todasLasImagenes: { nombre: string; url: string }[] = [];

    for (const carpeta of carpetas) {
      const { data, error } = await supabase.storage
        .from('productos')
        .list(carpeta, {
          limit: 100,
          sortBy: {
            column: 'name',
            order: 'asc',
          },
        });

      if (error) continue;

      data
        ?.filter((archivo) =>
          archivo.name.match(/\.(jpg|jpeg|png|webp)$/i)
        )
        .forEach((archivo) => {
          const ruta = carpeta
            ? `${carpeta}/${archivo.name}`
            : archivo.name;

          const { data: publicUrl } = supabase.storage
            .from('productos')
            .getPublicUrl(ruta);

          todasLasImagenes.push({
            nombre: archivo.name,
            url: publicUrl.publicUrl,
          });
        });
    }

    setImagenesStorage(todasLasImagenes);
  }

  useEffect(() => {
    if (autorizado) {
      cargarProductos();
      cargarFamilias();
      cargarImagenesStorage();
    }
  }, [autorizado]);

  function entrar() {
    if (clave.trim() === CLAVE_ADMIN) {
      setAutorizado(true);
      return;
    }

    alert('Clave incorrecta');
  }

  function limpiarFormulario() {
    setProductoEditando(null);
    setForm(formInicial);
  }

  function editarProducto(producto: Producto) {
    setProductoEditando(producto);

    const tipoProducto = producto.tipo_producto || 'producto';

    setForm({
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
      iva_porcentaje: String(producto.iva_porcentaje ?? 19),
      impuesto_adicional_porcentaje: String(
        producto.impuesto_adicional_porcentaje ?? 0
      ),
      stock_actual: String(producto.stock_actual ?? 0),
      stock_minimo: String(producto.stock_minimo ?? 0),
      activo: producto.activo ?? true,
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
            : 'Envases',
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
      unidad_base: esInsumo ? form.unidad_base : null,
      costo_unitario: esInsumo
        ? Number(form.costo_unitario || 0)
        : 0,
      iva_porcentaje: Number(form.iva_porcentaje || 19),
      impuesto_adicional_porcentaje: Number(
        form.impuesto_adicional_porcentaje || 0
      ),
      stock_actual: Number(form.stock_actual || 0),
      stock_minimo: Number(form.stock_minimo || 0),
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

  if (!autorizado) {
    return (
     
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
              if (e.key === 'Enter') entrar();
            }}
            placeholder="Clave admin"
            className="mt-8 w-full rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
          />

          <button
            type="button"
            onClick={entrar}
            className="mt-5 w-full rounded-full bg-maruxa-rojo px-5 py-4 font-black text-white"
          >
            Entrar
          </button>
        </div>
      
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
            {productoEditando ? 'Editar producto' : 'Crear producto'}
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
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
              <input
                placeholder="Precio de venta"
                type="number"
                value={form.precio}
                onChange={(e) =>
                  setForm({
                    ...form,
                    precio: e.target.value,
                  })
                }
                className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
              />
            )}

            {esInsumo && (
              <>
                <select
                  value={form.unidad_base}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      unidad_base: e.target.value,
                    })
                  }
                  className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
                >
                  <option value="KG">KG</option>
                  <option value="LT">LT</option>
                  <option value="UN">UN</option>
                  <option value="GR">GR</option>
                  <option value="ML">ML</option>
                  <option value="CC">CC</option>
                </select>

                <input
                  placeholder="Costo unitario"
                  type="number"
                  value={form.costo_unitario}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      costo_unitario: e.target.value,
                    })
                  }
                  className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
                />

                <input
                  placeholder="IVA %"
                  type="number"
                  value={form.iva_porcentaje}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      iva_porcentaje: e.target.value,
                    })
                  }
                  className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
                />

                <input
                  placeholder="Impuesto adicional %"
                  type="number"
                  value={form.impuesto_adicional_porcentaje}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      impuesto_adicional_porcentaje: e.target.value,
                    })
                  }
                  className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
                />

                <input
                  placeholder="Stock actual"
                  type="number"
                  value={form.stock_actual}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      stock_actual: e.target.value,
                    })
                  }
                  className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
                />

                <input
                  placeholder="Stock mínimo"
                  type="number"
                  value={form.stock_minimo}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      stock_minimo: e.target.value,
                    })
                  }
                  className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
                />
              </>
            )}

            {esProducto && (
              <select
                value={form.familia_id ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    familia_id: e.target.value,
                  })
                }
                className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
              >
                <option value="">Seleccionar familia</option>

                {familias.map((familia) => (
                  <option key={familia.id} value={familia.id}>
                    {familia.nombre}
                  </option>
                ))}
              </select>
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
                <input
                  placeholder="Precio 10 personas"
                  type="number"
                  value={form.precio_10}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      precio_10: e.target.value,
                    })
                  }
                  className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
                />

                <input
                  placeholder="Precio 15 personas"
                  type="number"
                  value={form.precio_15}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      precio_15: e.target.value,
                    })
                  }
                  className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
                />

                <input
                  placeholder="Precio 20 personas"
                  type="number"
                  value={form.precio_20}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      precio_20: e.target.value,
                    })
                  }
                  className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
                />

                <input
                  placeholder="Precio 25 personas"
                  type="number"
                  value={form.precio_25}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      precio_25: e.target.value,
                    })
                  }
                  className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
                />
              </>
            )}

            {esProducto && (
              <input
                placeholder="URL imagen"
                value={form.imagen}
                onChange={(e) =>
                  setForm({
                    ...form,
                    imagen: e.target.value,
                  })
                }
                className="rounded-2xl border border-maruxa-rojo/10 px-5 py-4 font-bold outline-none"
              />
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

        {esProducto && (
          <section className="mb-10 rounded-[34px] bg-white p-6 shadow-premium">
            <h2 className="text-2xl font-black text-maruxa-chocolate">
              Imágenes del Storage
            </h2>

            <p className="mt-2 text-sm font-bold text-maruxa-cafe/70">
              Imágenes cargadas: {imagenesStorage.length}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {imagenesStorage.map((imagen) => {
                const nombreLimpio = imagen.nombre
                  .replace(/\.[^/.]+$/, '')
                  .replace(/[-_]/g, ' ');

                return (
                  <button
                    key={imagen.url}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        nombre: nombreLimpio,
                        imagen: imagen.url,
                      })
                    }
                    className="overflow-hidden rounded-[24px] bg-maruxa-crema text-left shadow-premium transition hover:-translate-y-1"
                  >
                    <img
                      src={imagen.url}
                      alt={imagen.nombre}
                      className="h-40 w-full object-cover"
                    />

                    <div className="p-3">
                      <p className="line-clamp-2 text-xs font-black text-maruxa-chocolate">
                        {imagen.nombre}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="grid gap-4">
          {cargando && (
            <div className="rounded-[28px] bg-white p-6 font-black shadow-premium">
              Cargando productos...
            </div>
          )}

          {productos.map((producto) => {
            const tipo = producto.tipo_producto || 'producto';
            const esInsumoLista =
              tipo === 'ingrediente' || tipo === 'envase';

            return (
              <article
                key={producto.id}
                onClick={() => editarProducto(producto)}
                className="cursor-pointer rounded-[28px] bg-white p-5 shadow-premium transition hover:-translate-y-1 hover:ring-2 hover:ring-maruxa-rojo/20"
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-maruxa-rojo">
                      {tipo === 'producto'
                        ? producto.categoria
                        : tipo === 'ingrediente'
                          ? 'Ingrediente'
                          : 'Envase'}
                    </p>

                    {tipo === 'producto' &&
                      producto.familias_productos?.nombre && (
                        <span className="mt-2 inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-black text-purple-700">
                          📂 {producto.familias_productos?.nombre}
                        </span>
                      )}

                    {tipo === 'producto' &&
                      !producto.usar_configuracion_familia && (
                        <span className="mt-2 ml-2 inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">
                          Margen personalizado
                        </span>
                      )}

                    {!producto.activo && (
                      <span className="mt-2 ml-2 inline-flex rounded-full bg-gray-200 px-3 py-1 text-xs font-black text-gray-700">
                        Inactivo
                      </span>
                    )}

                    <h3 className="mt-2 text-2xl font-black text-maruxa-chocolate">
                      {producto.nombre}
                    </h3>

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
        </section>
      </div>
    </main>
  );
}