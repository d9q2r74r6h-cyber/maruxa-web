'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';

type Producto = {
  id: number;
  codigo: string | null;
  nombre: string;
  tipo_producto: string;
  familia_id: string | null;
  unidad_base: string | null;
  stock_actual: number | null;
  costo_unitario: number | null;
  precio: number | null;
  controla_stock: boolean | null;
  usar_configuracion_familia?: boolean | null;
  margen_personalizado?: number | null;
  tipo_margen_personalizado?: 'markup' | 'margen_comercial' | null;
};

type UltimaCompraProducto = {
  producto_id: number;
  fecha: string;
  precio: number;
  precio_venta: number | null;
  margen_porcentaje: number | null;
  origen?: 'historial' | 'ficha_actual';
};

type ProveedorCompra = {
  id: string;
  razon_social: string;
  precio_iva_incluido: boolean;
};

type FamiliaProducto = {
  id: string;
  nombre: string;
  activo: boolean;
  mostrar_catalogo: boolean | null;
  tipo_margen: 'markup' | 'margen_comercial';
  margen_porcentaje: number;
  redondeo_precio: number;
};

type ItemCompra = {
  producto_id: string;
  busqueda_producto: string;
  cantidad: string;
  costo_unitario: string;
  costo_total: string;
  margen_porcentaje: string;
  tipo_margen: 'markup' | 'margen_comercial';
  precio_venta: string;
  precio_listado: boolean;
  texto_listado_1: string;
  texto_listado_2: string;
};

type TipoProductoCompra = 'producto' | 'ingrediente' | 'envase';

type ProductoEdicion = {
  codigo: string;
  nombre: string;
  tipo_producto: TipoProductoCompra;
  familia_id: string;
  unidad_base: string;
  costo_unitario: string;
  stock_actual: string;
  controla_stock: boolean;
};

type ItemCompraConsolidado = {
  producto_id: string;
  cantidad: number;
  costo_unitario: number;
};

type VariacionCosto = {
  producto_id: number;
  nombre: string;
  unidad_base: string | null;
  costo_anterior: number;
  costo_compra: number;
  costo_nuevo: number;
  variacion_porcentaje: number;
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
};

type RecetaAfectada = {
  receta_id: string;
  receta_nombre: string;
  producto_nombre: string;
  ingredientes_afectados: string[];
  costo_kg_anterior: number;
  costo_kg_nuevo: number;
  costo_unidad_anterior: number;
  costo_unidad_nuevo: number;
  precio_sugerido_anterior: number;
  precio_sugerido_nuevo: number;
  variacion_porcentaje: number;
};

function itemCompraVacio(): ItemCompra {
  return {
    producto_id: '',
    busqueda_producto: '',
    cantidad: '1',
    costo_unitario: '',
    costo_total: '',
    margen_porcentaje: '',
    tipo_margen: 'markup',
    precio_venta: '',
    precio_listado: true,
    texto_listado_1: '',
    texto_listado_2: '',
  };
}

function numero(valor: string | number | null | undefined) {
  return Number(String(valor ?? 0).replace(',', '.')) || 0;
}

function dinero(valor: number) {
  return `$${Math.round(Number(valor || 0)).toLocaleString('es-CL')}`;
}

function entradaPeso(valor: string | number | null | undefined) {
  const monto = numero(valor);
  return monto ? dinero(monto) : '';
}

function valorPesoEntrada(valor: string) {
  return valor.replace(/\D/g, '');
}

function entradaPorcentaje(valor: string | number | null | undefined) {
  const porcentaje = numero(valor);
  return porcentaje
    ? `${porcentaje.toLocaleString('es-CL', { maximumFractionDigits: 2 })}%`
    : '';
}

function valorPorcentajeEntrada(valor: string) {
  return valor.replace(/[^0-9,.]/g, '').replace(',', '.');
}

function entero(valor: number) {
  return Math.round(Number(valor || 0));
}

function totalBaseItem(item: ItemCompra) {
  const totalManual = numero(item.costo_total);

  if (totalManual > 0) return totalManual;

  return numero(item.cantidad) * numero(item.costo_unitario);
}

function totalFinalItem(item: ItemCompra) {
  return totalBaseItem(item);
}

function costoUnitarioEfectivo(item: ItemCompra) {
  const cantidad = numero(item.cantidad);

  if (cantidad <= 0) return 0;

  return entero(totalFinalItem(item) / cantidad);
}

function precioVentaDesdeMargen(
  costo: number,
  margen: number,
  tipoMargen: 'markup' | 'margen_comercial',
  redondeo = 1
) {
  const precio =
    tipoMargen === 'margen_comercial' && margen < 100
      ? costo / (1 - margen / 100)
      : costo * (1 + margen / 100);

  return redondeo > 0 ? Math.ceil(precio / redondeo) * redondeo : precio;
}

function desgloseIva(valor: number, iva: number, ivaIncluido: boolean) {
  if (valor <= 0) return { neto: 0, iva: 0, total: 0 };

  if (ivaIncluido) {
    const neto = valor / (1 + iva / 100);
    return { neto, iva: valor - neto, total: valor };
  }

  const montoIva = valor * (iva / 100);
  return { neto: valor, iva: montoIva, total: valor + montoIva };
}

function normalizarTexto(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function crearSlug(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizarCodigo(texto: string | null | undefined) {
  return String(texto || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ñ/g, 'N')
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 3);
}

function calcularPrecioSugerido(costoUnidad: number, producto: any) {
  const familiaRelacion = producto?.familias_productos;
  const familia = Array.isArray(familiaRelacion)
    ? familiaRelacion[0]
    : familiaRelacion;
  const usaFamilia = producto?.usar_configuracion_familia ?? true;
  const margen = usaFamilia
    ? numero(familia?.margen_porcentaje)
    : numero(producto?.margen_personalizado);
  const tipoMargen = usaFamilia
    ? familia?.tipo_margen || 'markup'
    : producto?.tipo_margen_personalizado || 'markup';
  const redondeo = usaFamilia
    ? numero(familia?.redondeo_precio)
    : numero(producto?.redondeo_personalizado);

  let precio =
    tipoMargen === 'margen_comercial' && margen < 100
      ? costoUnidad / (1 - margen / 100)
      : costoUnidad * (1 + margen / 100);

  if (redondeo > 0) {
    precio = Math.ceil(precio / redondeo) * redondeo;
  }

  return precio;
}

export default function AdminComprasPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorCompra[]>([]);
  const [proveedorId, setProveedorId] = useState('');
  const [proveedorTexto, setProveedorTexto] = useState('');
  const [precioIvaIncluido, setPrecioIvaIncluido] = useState(true);
  const [ivaPorcentaje, setIvaPorcentaje] = useState(19);
  const [mostrarProveedores, setMostrarProveedores] = useState(false);
  const [buscandoProveedores, setBuscandoProveedores] = useState(false);
  const [familias, setFamilias] = useState<FamiliaProducto[]>([]);
  const [items, setItems] = useState<ItemCompra[]>(() => [itemCompraVacio()]);
  const [resultadosBusqueda, setResultadosBusqueda] = useState<Record<number, Producto[]>>({});
  const [ultimasCompras, setUltimasCompras] = useState<Record<number, UltimaCompraProducto[]>>({});
  const [mostrarCrearProducto, setMostrarCrearProducto] = useState(false);
  const [indiceItemCreacion, setIndiceItemCreacion] = useState<number | null>(null);
  const [nuevoProducto, setNuevoProducto] = useState({
    codigo: '',
    nombre: '',
    tipo_producto: 'ingrediente' as TipoProductoCompra,
    familia_id: '',
    unidad_base: 'KG',
    costo_unitario: '',
    stock_actual: '',
    controla_stock: true,
  });
  const [coincidenciasNuevoProducto, setCoincidenciasNuevoProducto] = useState<Producto[]>([]);
  const [buscandoNuevoProducto, setBuscandoNuevoProducto] = useState(false);
  const [productoEditandoId, setProductoEditandoId] = useState<number | null>(null);
  const [productoEditando, setProductoEditando] = useState<ProductoEdicion>({
    codigo: '',
    nombre: '',
    tipo_producto: 'ingrediente',
    familia_id: '',
    unidad_base: 'KG',
    costo_unitario: '',
    stock_actual: '',
    controla_stock: true,
  });
  const [guardandoProductoEditado, setGuardandoProductoEditado] = useState(false);
  const [fichaEditandoId, setFichaEditandoId] = useState<number | null>(null);
  const [fichaEditando, setFichaEditando] = useState({
    fecha: '',
    costo: '',
    margen: '',
    precioVenta: '',
  });
  const [guardandoFicha, setGuardandoFicha] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [variacionesCompra, setVariacionesCompra] = useState<VariacionCosto[]>([]);
  const [mostrarVariaciones, setMostrarVariaciones] = useState(false);
  const [recetasAfectadas, setRecetasAfectadas] = useState<RecetaAfectada[]>([]);
  const [cargandoRecetasAfectadas, setCargandoRecetasAfectadas] = useState(false);

  const subtotalProductos = useMemo(() => {
    return items.reduce((total, item) => {
      return (
        total +
        desgloseIva(totalFinalItem(item), ivaPorcentaje, precioIvaIncluido).total
      );
    }, 0);
  }, [items, ivaPorcentaje, precioIvaIncluido]);
  const totalCompra = subtotalProductos;

  const familiaNuevoProducto = familias.find(
    (familia) => familia.id === nuevoProducto.familia_id
  );
  const prefijoTipoProducto: Record<TipoProductoCompra, string> = {
    producto: 'PRO',
    ingrediente: 'ING',
    envase: 'ENV',
  };
  const baseCodigoNuevoProducto =
    familiaNuevoProducto?.nombre || nuevoProducto.nombre || 'GEN';
  const prefijoCodigoNuevoProducto = `${
    prefijoTipoProducto[nuevoProducto.tipo_producto]
  }-${normalizarCodigo(baseCodigoNuevoProducto) || 'GEN'}`;
  const codigoSugeridoNuevoProducto = useMemo(() => {
    if (nuevoProducto.codigo.trim()) {
      return nuevoProducto.codigo.trim().toUpperCase();
    }

    const usados = new Set(
      productos
        .map((producto) => String(producto.codigo || '').toUpperCase())
        .filter((codigo) => codigo.startsWith(`${prefijoCodigoNuevoProducto}-`))
    );
    let correlativo = usados.size + 1;
    let codigo = `${prefijoCodigoNuevoProducto}-${String(correlativo).padStart(3, '0')}`;

    while (usados.has(codigo)) {
      correlativo += 1;
      codigo = `${prefijoCodigoNuevoProducto}-${String(correlativo).padStart(3, '0')}`;
    }

    return codigo;
  }, [nuevoProducto.codigo, prefijoCodigoNuevoProducto, productos]);

  function formatearFecha(valor: string) {
    if (!valor) return '-';

    return new Date(valor).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  async function cargarProductos() {
    setLoading(true);

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      setLoading(false);
      return;
    }

    setIvaPorcentaje(numero(empresa.iva_porcentaje ?? 19) || 19);

    const [{ data, error }, { data: familiasData }] = await Promise.all([
      supabase
      .from('productos')
      .select(`
        id,
        codigo,
        nombre,
        tipo_producto,
        familia_id,
        unidad_base,
        stock_actual,
        costo_unitario,
        precio,
        controla_stock,
        usar_configuracion_familia,
        margen_personalizado,
        tipo_margen_personalizado
      `)
      .eq('empresa_id', empresa.id)
      .in('tipo_producto', ['producto', 'ingrediente', 'envase'])
      .eq('activo', true)
      .order('nombre', { ascending: true }),
      supabase
        .from('familias_productos')
        .select('id,nombre,activo,mostrar_catalogo,tipo_margen,margen_porcentaje,redondeo_precio')
        .eq('empresa_id', empresa.id)
        .eq('activo', true)
        .order('nombre', { ascending: true }),
    ]);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setProductos((data as Producto[]) || []);
    setFamilias((familiasData as FamiliaProducto[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    cargarProductos();
  }, []);

  useEffect(() => {
    if (!mostrarProveedores) return;

    const timer = setTimeout(async () => {
      const empresa = await obtenerEmpresaActual();
      if (!empresa) return;

      setBuscandoProveedores(true);
      let consulta = supabase
        .from('proveedores')
        .select('*')
        .eq('empresa_id', empresa.id)
        .eq('activo', true)
        .order('razon_social', { ascending: true })
        .limit(20);

      const termino = proveedorTexto.trim();
      if (termino) {
        consulta = consulta.ilike('razon_social', `%${termino}%`);
      }

      const { data, error } = await consulta;
      setProveedores(
        error
          ? []
          : (data || []).map((item) => {
              const guardadoLocal = window.localStorage.getItem(
                `proveedor-iva-incluido:${item.id}`
              );
              return {
                id: item.id,
                razon_social: item.razon_social,
                precio_iva_incluido:
                  typeof item.precio_iva_incluido === 'boolean'
                    ? item.precio_iva_incluido
                    : guardadoLocal !== 'false',
              };
            })
      );
      setBuscandoProveedores(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [mostrarProveedores, proveedorTexto]);

  function recalcularPreciosPorIva(incluido: boolean) {
    setItems((actuales) =>
      actuales.map((item) => ({
        ...item,
        precio_venta: item.costo_unitario
          ? String(
              precioVentaDesdeMargen(
                desgloseIva(numero(item.costo_unitario), ivaPorcentaje, incluido)
                  .total,
                numero(item.margen_porcentaje),
                item.tipo_margen
              ) || ''
            )
          : item.precio_venta,
      }))
    );
  }

  async function cambiarPrecioIvaProveedor(incluido: boolean) {
    setPrecioIvaIncluido(incluido);
    recalcularPreciosPorIva(incluido);
    window.localStorage.setItem(
      `proveedor-iva-incluido:${proveedorId}`,
      String(incluido)
    );
    if (!proveedorId) return;

    const { error } = await supabase
      .from('proveedores')
      .update({ precio_iva_incluido: incluido })
      .eq('id', proveedorId);

    if (!error) {
      setProveedores((actuales) =>
        actuales.map((proveedor) =>
          proveedor.id === proveedorId
            ? { ...proveedor, precio_iva_incluido: incluido }
            : proveedor
        )
      );
    }
  }

  async function seleccionarProveedor(proveedor: ProveedorCompra) {
    setProveedorId(proveedor.id);
    setProveedorTexto(proveedor.razon_social);
    setMostrarProveedores(false);

    const configuracionLocal = window.localStorage.getItem(
      `proveedor-iva-incluido:${proveedor.id}`
    );
    let ivaIncluidoProveedor = proveedor.precio_iva_incluido ?? true;

    const { data, error } = await supabase
      .from('proveedores')
      .select('precio_iva_incluido')
      .eq('id', proveedor.id)
      .single();

    if (!error && typeof data?.precio_iva_incluido === 'boolean') {
      ivaIncluidoProveedor = data.precio_iva_incluido;
      window.localStorage.setItem(
        `proveedor-iva-incluido:${proveedor.id}`,
        String(ivaIncluidoProveedor)
      );
    } else if (
      configuracionLocal === 'true' ||
      configuracionLocal === 'false'
    ) {
      ivaIncluidoProveedor = configuracionLocal === 'true';
    }

    setPrecioIvaIncluido(ivaIncluidoProveedor);
    recalcularPreciosPorIva(ivaIncluidoProveedor);
  }

  async function cargarUltimasCompras(productoIds: number[]) {
    const idsPendientes = [...new Set(productoIds)].filter(
      (id) => id && !ultimasCompras[id]
    );

    if (idsPendientes.length === 0) return;

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      setUltimasCompras((actuales) => {
        const siguiente = { ...actuales };
        idsPendientes.forEach((id) => {
          siguiente[id] = [];
        });
        return siguiente;
      });
      return;
    }

    let { data, error } = await supabase
      .from('producto_costos_historial')
      .select('producto_id,created_at,costo_compra,observacion')
      .eq('empresa_id', empresa.id)
      .in('producto_id', idsPendientes)
      .order('created_at', { ascending: false })
      .limit(idsPendientes.length * 6);

    if (error) {
      const respaldo = await supabase
        .from('producto_costos_historial')
        .select('producto_id,created_at,costo_compra')
        .eq('empresa_id', empresa.id)
        .in('producto_id', idsPendientes)
        .order('created_at', { ascending: false })
        .limit(idsPendientes.length * 6);

      data = (respaldo.data || []).map((item) => ({
        ...item,
        observacion: null,
      }));
      error = respaldo.error;
    }

    if (error) {
      setUltimasCompras((actuales) => {
        const siguiente = { ...actuales };
        idsPendientes.forEach((id) => {
          siguiente[id] = [];
        });
        return siguiente;
      });
      return;
    }

    const agrupadas = new Map<number, UltimaCompraProducto[]>();

    for (const item of data || []) {
      const productoId = Number(item.producto_id);
      const actuales = agrupadas.get(productoId) || [];

      if (actuales.length >= 5) continue;

      const observacion = String(item.observacion || '');
      const precioVenta = observacion.match(/precio venta:\s*([0-9]+)/i);
      const margen = observacion.match(/margen:\s*([0-9.,]+)/i);

      actuales.push({
        producto_id: productoId,
        fecha: item.created_at,
        precio: numero(item.costo_compra),
        precio_venta: precioVenta ? numero(precioVenta[1]) : null,
        margen_porcentaje: margen ? numero(margen[1]) : null,
      });
      agrupadas.set(productoId, actuales);
    }

    setUltimasCompras((actuales) => {
      const siguiente = { ...actuales };

      for (const id of idsPendientes) {
        siguiente[id] = agrupadas.get(id) || [];
      }

      return siguiente;
    });
  }

  useEffect(() => {
    const ids = new Set<number>();

    for (const item of items) {
      if (item.producto_id) {
        ids.add(Number(item.producto_id));
        continue;
      }

      const termino = normalizarTexto(item.busqueda_producto);

      if (termino.length < 2) continue;

      productos
        .filter((productoItem) =>
          normalizarTexto(
            `${productoItem.codigo || ''} ${productoItem.nombre} ${productoItem.tipo_producto}`
          ).includes(termino)
        )
        .slice(0, 8)
        .forEach((productoItem) => ids.add(productoItem.id));
    }

    if (ids.size === 0) return;

    const timer = setTimeout(() => {
      cargarUltimasCompras([...ids]);
    }, 250);

    return () => clearTimeout(timer);
  }, [items, productos, ultimasCompras]);

  useEffect(() => {
    const termino = nuevoProducto.nombre.trim();

    if (!mostrarCrearProducto || termino.length < 2) {
      setCoincidenciasNuevoProducto([]);
      setBuscandoNuevoProducto(false);
      return;
    }

    const timer = setTimeout(async () => {
      setBuscandoNuevoProducto(true);

      const empresa = await obtenerEmpresaActual();

      if (!empresa) {
        setBuscandoNuevoProducto(false);
        return;
      }

      const { data, error } = await supabase
        .from('productos')
        .select(`
          id,
          codigo,
          nombre,
          tipo_producto,
          familia_id,
          unidad_base,
          stock_actual,
          costo_unitario,
          controla_stock
        `)
        .eq('empresa_id', empresa.id)
        .in('tipo_producto', ['producto', 'ingrediente', 'envase'])
        .eq('activo', true)
        .or(`nombre.ilike.%${termino}%,codigo.ilike.%${termino}%`)
        .order('nombre', { ascending: true })
        .limit(8);

      if (!error) {
        setCoincidenciasNuevoProducto((data as Producto[]) || []);
      }

      setBuscandoNuevoProducto(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [mostrarCrearProducto, nuevoProducto.nombre]);

  function agregarItem() {
    setItems([...items, itemCompraVacio()]);
  }

  function eliminarItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function actualizarItem(index: number, campo: keyof ItemCompra, valor: string) {
    setItems(
      items.map((item, i) => {
        if (i !== index) return item;

        if (campo === 'producto_id') {
          const producto = productos.find((p) => String(p.id) === String(valor));
          const familia = familias.find((f) => f.id === producto?.familia_id);
          const margen = numero(familia?.margen_porcentaje);
          const tipoMargen = familia?.tipo_margen || 'markup';

          return {
            ...item,
            producto_id: valor,
            busqueda_producto: producto
              ? `${producto.nombre} - ${producto.tipo_producto}`
              : item.busqueda_producto,
            costo_unitario: '',
            costo_total: '',
            margen_porcentaje: String(margen || ''),
            tipo_margen: tipoMargen,
            precio_venta: '',
            texto_listado_1: '',
            texto_listado_2: '',
          };
        }

        if (campo === 'busqueda_producto') {
          return {
            ...item,
            producto_id: '',
            busqueda_producto: valor,
          };
        }

        if (campo === 'cantidad') {
          const cantidad = numero(valor);
          const totalLinea = numero(item.costo_total);

          return {
            ...item,
            cantidad: valor,
            costo_unitario:
              cantidad > 0 && totalLinea > 0
                ? String(entero(totalLinea / cantidad))
                : item.costo_unitario,
          };
        }

        if (campo === 'costo_unitario') {
          const cantidad = numero(item.cantidad);
          const costoUnitario = numero(valor);
          const costoTotal = desgloseIva(
            costoUnitario,
            ivaPorcentaje,
            precioIvaIncluido
          ).total;

          return {
            ...item,
            costo_unitario: valor,
            costo_total:
              cantidad > 0 && costoUnitario > 0
                ? String(cantidad * costoUnitario)
                : item.costo_total,
            precio_venta: String(
              precioVentaDesdeMargen(
                costoTotal,
                numero(item.margen_porcentaje),
                item.tipo_margen
              ) || ''
            ),
          };
        }

        if (campo === 'margen_porcentaje') {
          return {
            ...item,
            margen_porcentaje: valor,
            precio_venta: String(
              precioVentaDesdeMargen(
                desgloseIva(
                  numero(item.costo_unitario),
                  ivaPorcentaje,
                  precioIvaIncluido
                ).total,
                numero(valor),
                item.tipo_margen
              ) || ''
            ),
          };
        }

        if (campo === 'costo_total') {
          const cantidad = numero(item.cantidad);
          const totalLinea = numero(valor);

          return {
            ...item,
            costo_total: valor,
            costo_unitario:
              cantidad > 0 && totalLinea > 0
                ? String(entero(totalLinea / cantidad))
                : item.costo_unitario,
          };
        }

        return {
          ...item,
          [campo]: valor,
        };
      })
    );
  }

  function abrirEdicionProducto(producto: Producto) {
    setProductoEditandoId(producto.id);
    setProductoEditando({
      codigo: producto.codigo || '',
      nombre: producto.nombre || '',
      tipo_producto: (producto.tipo_producto || 'ingrediente') as TipoProductoCompra,
      familia_id: producto.familia_id || '',
      unidad_base: producto.unidad_base || 'KG',
      costo_unitario: String(producto.costo_unitario || ''),
      stock_actual: String(producto.stock_actual || ''),
      controla_stock: producto.controla_stock ?? true,
    });
  }

  function cerrarEdicionProducto() {
    setProductoEditandoId(null);
    setProductoEditando({
      codigo: '',
      nombre: '',
      tipo_producto: 'ingrediente',
      familia_id: '',
      unidad_base: 'KG',
      costo_unitario: '',
      stock_actual: '',
      controla_stock: true,
    });
  }

  async function guardarProductoEditado() {
    if (!productoEditandoId) return;

    if (!productoEditando.nombre.trim()) {
      alert('Ingresa el nombre del producto.');
      return;
    }

    setGuardandoProductoEditado(true);

    const datos = {
      codigo: productoEditando.codigo.trim().toUpperCase() || null,
      nombre: productoEditando.nombre.trim(),
      tipo_producto: productoEditando.tipo_producto,
      familia_id: productoEditando.familia_id || null,
      unidad_base: productoEditando.unidad_base,
      costo_unitario: numero(productoEditando.costo_unitario),
      stock_actual: numero(productoEditando.stock_actual),
      controla_stock: productoEditando.controla_stock,
    };

    const { error } = await supabase
      .from('productos')
      .update(datos)
      .eq('id', productoEditandoId);

    setGuardandoProductoEditado(false);

    if (error) {
      alert(error.message);
      return;
    }

    setProductos((actuales) =>
      actuales
        .map((producto) =>
          producto.id === productoEditandoId
            ? {
                ...producto,
                ...datos,
              }
            : producto
        )
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
    );

    setItems((actuales) =>
      actuales.map((item) =>
        String(item.producto_id) === String(productoEditandoId)
          ? {
              ...item,
              busqueda_producto: `${datos.nombre} - ${datos.tipo_producto}`,
              costo_unitario: item.costo_unitario || String(datos.costo_unitario || ''),
            }
          : item
      )
    );

    cerrarEdicionProducto();
  }

  function editarFichaVigente(producto: Producto, margenFamilia: number) {
    setFichaEditandoId(producto.id);
    setFichaEditando({
      fecha: new Date().toISOString().slice(0, 10),
      costo: String(producto.costo_unitario || ''),
      margen: String(
        producto.usar_configuracion_familia === false
          ? producto.margen_personalizado || ''
          : margenFamilia || ''
      ),
      precioVenta: String(producto.precio || ''),
    });
  }

  async function guardarFichaVigente(producto: Producto) {
    setGuardandoFicha(true);
    const empresa = await obtenerEmpresaActual();
    if (!empresa) {
      setGuardandoFicha(false);
      alert('No se pudo identificar la empresa.');
      return;
    }
    const cambios = {
      costo_unitario: numero(fichaEditando.costo),
      precio: numero(fichaEditando.precioVenta),
      usar_configuracion_familia: false,
      margen_personalizado: numero(fichaEditando.margen),
      tipo_margen_personalizado:
        producto.tipo_margen_personalizado ||
        familias.find((familia) => familia.id === producto.familia_id)
          ?.tipo_margen ||
        ('markup' as const),
    };
    const { error } = await supabase
      .from('productos')
      .update(cambios)
      .eq('id', producto.id);

    if (error) {
      setGuardandoFicha(false);
      alert(error.message);
      return;
    }

    setProductos((actuales) =>
      actuales.map((item) =>
        item.id === producto.id ? { ...item, ...cambios } : item
      )
    );

    const fechaRegistro = fichaEditando.fecha || new Date().toISOString().slice(0, 10);
    const { data: historialCreado, error: errorHistorial } = await supabase
      .from('producto_costos_historial')
      .insert({
        empresa_id: empresa.id,
        producto_id: producto.id,
        costo_anterior: numero(producto.costo_unitario),
        costo_compra: cambios.costo_unitario,
        costo_nuevo_promedio: cambios.costo_unitario,
        variacion_porcentaje: 0,
        stock_anterior: numero(producto.stock_actual),
        cantidad_comprada: 0,
        stock_nuevo: numero(producto.stock_actual),
        created_at: `${fechaRegistro}T12:00:00`,
        observacion: `Ficha vigente editada | Precio venta: ${cambios.precio} | Margen: ${cambios.margen_personalizado}`,
      })
      .select('created_at')
      .single();

    setGuardandoFicha(false);
    if (errorHistorial) {
      alert(`La ficha se actualizó, pero no se pudo guardar la fecha: ${errorHistorial.message}`);
      setFichaEditandoId(null);
      return;
    }
    setUltimasCompras((actuales) => ({
      ...actuales,
      [producto.id]: [
        {
          producto_id: producto.id,
          fecha: historialCreado.created_at,
          precio: cambios.costo_unitario,
          precio_venta: cambios.precio || null,
          margen_porcentaje: cambios.margen_personalizado || null,
          origen: 'historial' as const,
        },
        ...(actuales[producto.id] || []),
      ].slice(0, 5),
    }));
    setFichaEditandoId(null);
  }

  async function generarCodigoProductoCompra(empresaId: string | number) {
    const prefijo = prefijoCodigoNuevoProducto;

    const { data, error } = await supabase
      .from('productos')
      .select('codigo')
      .eq('empresa_id', empresaId)
      .ilike('codigo', `${prefijo}-%`);

    if (error) {
      throw new Error(error.message);
    }

    const usados = new Set(
      (data || [])
        .map((item) => String(item.codigo || '').toUpperCase())
        .filter(Boolean)
    );

    let correlativo = usados.size + 1;
    let codigo = `${prefijo}-${String(correlativo).padStart(3, '0')}`;

    while (usados.has(codigo)) {
      correlativo += 1;
      codigo = `${prefijo}-${String(correlativo).padStart(3, '0')}`;
    }

    return codigo;
  }

  async function crearProductoRapido() {
    if (!nuevoProducto.nombre.trim()) {
      alert('Ingresa el nombre del producto.');
      return;
    }

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      return;
    }

    const tipo = nuevoProducto.tipo_producto;
    const categoria =
      tipo === 'producto'
        ? 'Productos'
        : tipo === 'ingrediente'
          ? 'Ingredientes'
          : 'Envases';
    const costo = numero(nuevoProducto.costo_unitario);
    const stockInicial = numero(nuevoProducto.stock_actual);
    let codigoFinal = nuevoProducto.codigo.trim().toUpperCase();

    if (!codigoFinal) {
      try {
        codigoFinal = await generarCodigoProductoCompra(empresa.id);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'No se pudo generar el codigo.');
        return;
      }
    }

    const { data, error } = await supabase
      .from('productos')
      .insert({
        empresa_id: empresa.id,
        codigo: codigoFinal,
        nombre: nuevoProducto.nombre.trim(),
        descripcion: '',
        precio: 0,
        categoria,
        imagen: null,
        destacado: false,
        slug: crearSlug(nuevoProducto.nombre.trim()),
        tipo_producto: tipo,
        familia_id: nuevoProducto.familia_id || null,
        unidad_base: nuevoProducto.unidad_base,
        costo_unitario: costo,
        iva_porcentaje: Number(empresa.iva_porcentaje ?? 19),
        impuesto_adicional_porcentaje: 0,
        stock_actual: stockInicial,
        stock_minimo: 0,
        activo: true,
        controla_stock: nuevoProducto.controla_stock,
      })
      .select(`
        id,
        codigo,
        nombre,
        tipo_producto,
        familia_id,
        unidad_base,
        stock_actual,
        costo_unitario,
        precio,
        controla_stock
      `)
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    const productoCreado = data as Producto;

    setProductos((actuales) =>
      [...actuales, productoCreado].sort((a, b) =>
        a.nombre.localeCompare(b.nombre)
      )
    );
    const itemProductoCreado = {
        producto_id: String(productoCreado.id),
        busqueda_producto: `${productoCreado.nombre} - ${productoCreado.tipo_producto}`,
        cantidad: '1',
        costo_unitario: '',
        costo_total: '',
        margen_porcentaje: '',
        tipo_margen: 'markup' as const,
        precio_venta: '',
        precio_listado: true,
        texto_listado_1: '',
        texto_listado_2: '',
      };
    setItems((actuales) =>
      indiceItemCreacion === null
        ? [...actuales, itemProductoCreado]
        : actuales.map((item, indice) =>
            indice === indiceItemCreacion ? itemProductoCreado : item
          )
    );
    setNuevoProducto({
      codigo: '',
      nombre: '',
      tipo_producto: 'ingrediente',
      familia_id: '',
      unidad_base: 'KG',
      costo_unitario: '',
      stock_actual: '',
      controla_stock: true,
    });
    setIndiceItemCreacion(null);
    setMostrarCrearProducto(false);
  }

  function consolidarItemsValidos() {
    const agrupados = new Map<string, ItemCompraConsolidado>();

    for (const item of items) {
      if (
        !item.producto_id ||
        numero(item.cantidad) <= 0 ||
        numero(item.costo_unitario) <= 0
      ) {
        continue;
      }

      const cantidad = numero(item.cantidad);
      const costoUnitario = desgloseIva(
        costoUnitarioEfectivo(item),
        ivaPorcentaje,
        precioIvaIncluido
      ).neto;
      const actual = agrupados.get(item.producto_id);

      if (!actual) {
        agrupados.set(item.producto_id, {
          producto_id: item.producto_id,
          cantidad,
          costo_unitario: costoUnitario,
        });
        continue;
      }

      const costoTotal =
        actual.cantidad * actual.costo_unitario + cantidad * costoUnitario;
      const cantidadTotal = actual.cantidad + cantidad;

      agrupados.set(item.producto_id, {
        producto_id: item.producto_id,
        cantidad: cantidadTotal,
        costo_unitario: cantidadTotal > 0 ? entero(costoTotal / cantidadTotal) : 0,
      });
    }

    return [...agrupados.values()];
  }

  function calcularVariaciones(itemsConsolidados: ItemCompraConsolidado[]) {
    return itemsConsolidados
      .map((item) => {
        const producto = productos.find((p) => String(p.id) === String(item.producto_id));

        if (!producto) return null;

        const stockAnterior = numero(producto.stock_actual);
        const costoAnterior = numero(producto.costo_unitario);
        const stockNuevo = stockAnterior + item.cantidad;

        const costoNuevoPromedio =
          stockNuevo > 0
            ? (stockAnterior * costoAnterior + item.cantidad * item.costo_unitario) / stockNuevo
            : item.costo_unitario;

        const variacionPorcentaje =
          costoAnterior > 0
            ? ((costoNuevoPromedio - costoAnterior) / costoAnterior) * 100
            : 0;

        return {
          producto_id: producto.id,
          nombre: producto.nombre,
          unidad_base: producto.unidad_base,
          costo_anterior: costoAnterior,
          costo_compra: item.costo_unitario,
          costo_nuevo: costoNuevoPromedio,
          variacion_porcentaje: variacionPorcentaje,
          cantidad: item.cantidad,
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo,
        };
      })
      .filter(Boolean) as VariacionCosto[];
  }

  async function cargarRecetasAfectadas(variaciones: VariacionCosto[]) {
    const variacionesPorProducto = new Map(
      variaciones.map((item) => [item.producto_id, item])
    );
    const productoIds = [...variacionesPorProducto.keys()];

    setRecetasAfectadas([]);

    if (productoIds.length === 0) return;

    setCargandoRecetasAfectadas(true);

    const { data: relaciones, error: errorRelaciones } = await supabase
      .from('receta_ingredientes')
      .select('receta_id')
      .in('ingrediente_id', productoIds);

    if (errorRelaciones) {
      alert(errorRelaciones.message);
      setCargandoRecetasAfectadas(false);
      return;
    }

    const recetaIds = [
      ...new Set((relaciones || []).map((item: any) => item.receta_id)),
    ];

    if (recetaIds.length === 0) {
      setCargandoRecetasAfectadas(false);
      return;
    }

    const { data: detalles, error: errorDetalles } = await supabase
      .from('receta_ingredientes')
      .select(`
        receta_id,
        ingrediente_id,
        cantidad,
        productos (
          id,
          nombre,
          costo_unitario,
          iva_porcentaje,
          impuesto_adicional_porcentaje,
          tipo_producto
        ),
        recetas (
          id,
          nombre,
          producto_id,
          rendimiento_kg,
          unidades_producidas,
          costos_indirectos_porcentaje,
          productos (
            nombre,
            usar_configuracion_familia,
            margen_personalizado,
            tipo_margen_personalizado,
            redondeo_personalizado,
            familias_productos (
              nombre,
              margen_porcentaje,
              tipo_margen,
              redondeo_precio
            )
          )
        )
      `)
      .in('receta_id', recetaIds);

    if (errorDetalles) {
      alert(errorDetalles.message);
      setCargandoRecetasAfectadas(false);
      return;
    }

    const recetasMap = new Map<string, any[]>();

    for (const detalle of detalles || []) {
      const lista = recetasMap.get(detalle.receta_id) || [];
      lista.push(detalle);
      recetasMap.set(detalle.receta_id, lista);
    }

    const afectadas: RecetaAfectada[] = [];

    for (const [recetaId, recetaDetalles] of recetasMap.entries()) {
      const receta = Array.isArray(recetaDetalles[0]?.recetas)
        ? recetaDetalles[0]?.recetas[0]
        : recetaDetalles[0]?.recetas;

      if (!receta) continue;

      let subtotalAnterior = 0;
      let subtotalNuevo = 0;
      const ingredientesAfectados = new Set<string>();

      for (const detalle of recetaDetalles) {
        const recurso = Array.isArray(detalle.productos)
          ? detalle.productos[0]
          : detalle.productos;
        const variacion = variacionesPorProducto.get(Number(detalle.ingrediente_id));
        const cantidad = numero(detalle.cantidad);
        const iva = numero(recurso?.iva_porcentaje);
        const adicional = numero(recurso?.impuesto_adicional_porcentaje);
        const factorImpuestos = 1 + iva / 100 + adicional / 100;
        const costoBase = numero(recurso?.costo_unitario);
        const costoAnterior = variacion?.costo_anterior ?? costoBase;
        const costoNuevo = variacion?.costo_nuevo ?? costoBase;

        subtotalAnterior += cantidad * costoAnterior * factorImpuestos;
        subtotalNuevo += cantidad * costoNuevo * factorImpuestos;

        if (variacion) {
          ingredientesAfectados.add(recurso?.nombre || variacion.nombre);
        }
      }

      const indirectos = numero(receta.costos_indirectos_porcentaje);
      const costoAnteriorTotal = subtotalAnterior * (1 + indirectos / 100);
      const costoNuevoTotal = subtotalNuevo * (1 + indirectos / 100);
      const rendimientoKg = numero(receta.rendimiento_kg);
      const unidades = numero(receta.unidades_producidas);
      const costoKgAnterior =
        rendimientoKg > 0 ? costoAnteriorTotal / rendimientoKg : 0;
      const costoKgNuevo =
        rendimientoKg > 0 ? costoNuevoTotal / rendimientoKg : 0;
      const costoUnidadAnterior =
        unidades > 0 ? costoAnteriorTotal / unidades : 0;
      const costoUnidadNuevo =
        unidades > 0 ? costoNuevoTotal / unidades : 0;
      const productoTerminado = Array.isArray(receta.productos)
        ? receta.productos[0]
        : receta.productos;

      afectadas.push({
        receta_id: recetaId,
        receta_nombre: receta.nombre,
        producto_nombre: productoTerminado?.nombre || receta.nombre,
        ingredientes_afectados: [...ingredientesAfectados],
        costo_kg_anterior: costoKgAnterior,
        costo_kg_nuevo: costoKgNuevo,
        costo_unidad_anterior: costoUnidadAnterior,
        costo_unidad_nuevo: costoUnidadNuevo,
        precio_sugerido_anterior: calcularPrecioSugerido(
          costoUnidadAnterior,
          productoTerminado
        ),
        precio_sugerido_nuevo: calcularPrecioSugerido(
          costoUnidadNuevo,
          productoTerminado
        ),
        variacion_porcentaje:
          costoUnidadAnterior > 0
            ? ((costoUnidadNuevo - costoUnidadAnterior) / costoUnidadAnterior) * 100
            : 0,
      });
    }

    setRecetasAfectadas(
      afectadas.sort(
        (a, b) => Math.abs(b.variacion_porcentaje) - Math.abs(a.variacion_porcentaje)
      )
    );
    setCargandoRecetasAfectadas(false);
  }

  async function calcularVariacionesPrevias() {
    const itemsValidos = consolidarItemsValidos();

    if (itemsValidos.length === 0) {
      alert('Agrega productos validos para ver variacion de costos.');
      return;
    }

    const variaciones = calcularVariaciones(itemsValidos);

    setVariacionesCompra(variaciones);
    setMostrarVariaciones(true);
    await cargarRecetasAfectadas(variaciones);
  }

  async function guardarCompra() {
    const itemsValidos = items.filter(
      (item) =>
        item.producto_id &&
        numero(item.cantidad) > 0 &&
        numero(item.costo_unitario) > 0
    );
    const itemsConsolidados = consolidarItemsValidos();

    if (itemsConsolidados.length === 0) {
      alert('Agrega productos válidos a la compra.');
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
        proveedor: proveedorId ? proveedorTexto.trim() : '',
        fecha: new Date().toISOString().slice(0, 10),
        total: totalCompra,
      })
      .select('id')
      .single();

    if (errorCompra) {
      alert(errorCompra.message);
      setGuardando(false);
      return;
    }

    const detalle = itemsValidos.map((item) => {
      const cantidad = numero(item.cantidad);
      const costoUnitario = desgloseIva(
        numero(item.costo_unitario),
        ivaPorcentaje,
        precioIvaIncluido
      ).neto;
      const costoUnitarioFinal = desgloseIva(
        costoUnitarioEfectivo(item),
        ivaPorcentaje,
        precioIvaIncluido
      ).neto;

      return {
        compra_id: compra.id,
        producto_id: Number(item.producto_id),
        cantidad,
        costo_unitario: costoUnitarioFinal || costoUnitario,
        costo_total: (costoUnitarioFinal || costoUnitario) * cantidad,
      };
    });

    const { error: errorDetalle } = await supabase
      .from('compra_detalle')
      .insert(detalle);

    if (errorDetalle) {
      alert(errorDetalle.message);
      setGuardando(false);
      return;
    }

    const variacionesRegistradas = calcularVariaciones(itemsConsolidados);
    const variacionesPorProducto = new Map(
      variacionesRegistradas.map((item) => [item.producto_id, item])
    );

    for (const item of itemsConsolidados) {
      const producto = productos.find((p) => String(p.id) === String(item.producto_id));

      if (!producto) continue;

      const itemIngresado = items.find(
        (detalle) => String(detalle.producto_id) === String(producto.id)
      );
      const precioVenta = numero(itemIngresado?.precio_venta);
      const margenIngresado = numero(itemIngresado?.margen_porcentaje);

      const cantidad = item.cantidad;
      const variacion = variacionesPorProducto.get(producto.id);
      const stockAnterior = variacion?.stock_anterior ?? numero(producto.stock_actual);
      const stockNuevo = variacion?.stock_nuevo ?? stockAnterior + cantidad;
      const costoAnterior = variacion?.costo_anterior ?? numero(producto.costo_unitario);
      const costoPromedio = variacion?.costo_nuevo ?? numero(producto.costo_unitario);
      const costoCompra = variacion?.costo_compra ?? item.costo_unitario;
      const variacionPorcentaje = variacion?.variacion_porcentaje ?? 0;

      const { error: errorProducto } = await supabase
        .from('productos')
        .update({
          stock_actual: stockNuevo,
          costo_unitario: costoPromedio,
          precio: precioVenta || numero(producto.precio),
        })
        .eq('id', producto.id);

      if (errorProducto) {
        alert(errorProducto.message);
        setGuardando(false);
        return;
      }

      if (producto.controla_stock) {
        const { error: errorMovimiento } = await supabase
          .from('movimientos_stock')
          .insert({
            empresa_id: empresa.id,
            producto_id: producto.id,
            tipo_movimiento: 'compra',
            cantidad,
            referencia_tipo: 'compra',
            referencia_id: compra.id,
            observacion: 'Ingreso manual de compra',
          });

        if (errorMovimiento) {
          alert(errorMovimiento.message);
          setGuardando(false);
          return;
        }
      }

      const { error: errorHistorialCosto } = await supabase
        .from('producto_costos_historial')
        .insert({
          empresa_id: empresa.id,
          producto_id: producto.id,
          costo_anterior: costoAnterior,
          costo_compra: costoCompra,
          costo_nuevo_promedio: costoPromedio,
          variacion_porcentaje: variacionPorcentaje,
          stock_anterior: stockAnterior,
          cantidad_comprada: cantidad,
          stock_nuevo: stockNuevo,
          referencia_tipo: 'compra',
          referencia_id: compra.id,
          observacion: `Ingreso manual de compra | Precio venta: ${precioVenta} | Margen: ${margenIngresado}`,
        });

      if (errorHistorialCosto) {
        alert(errorHistorialCosto.message);
        setGuardando(false);
        return;
      }
    }

    setItems([itemCompraVacio()]);
    setUltimasCompras({});
    setVariacionesCompra(variacionesRegistradas);
    setMostrarVariaciones(true);
    await cargarRecetasAfectadas(variacionesRegistradas);

    await cargarProductos();

    setGuardando(false);
    alert('Compra registrada correctamente.');
  }

  return (
    <>
      <p className="font-black uppercase tracking-[.24em] text-maruxa-rojo">
        Inventario
      </p>

      <h1 className="mt-3 text-5xl font-black text-maruxa-chocolate">
        Compras
      </h1>

      <section className="mt-10 rounded-[34px] bg-white p-6 shadow-premium">
        <h2 className="text-2xl font-black text-maruxa-chocolate">
          Nueva compra
        </h2>

        {loading ? (
          <p className="mt-6 font-black">Cargando productos...</p>
        ) : (
          <>
            <div className="relative mt-6 grid max-w-xl gap-1.5">
              <span className="text-xs font-black uppercase tracking-wide text-maruxa-cafe/60">
                Proveedor
              </span>
              <input
                value={proveedorTexto}
                onFocus={() => setMostrarProveedores(true)}
                onBlur={() =>
                  setTimeout(() => setMostrarProveedores(false), 150)
                }
                onChange={(e) => {
                  setProveedorTexto(e.target.value);
                  setProveedorId('');
                  setPrecioIvaIncluido(true);
                  setMostrarProveedores(true);
                }}
                placeholder="Buscar proveedor..."
                autoComplete="off"
                className="rounded-2xl border bg-white px-4 py-3 font-bold text-maruxa-chocolate"
              />

              {mostrarProveedores && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl border bg-white shadow-xl">
                  {buscandoProveedores ? (
                    <p className="px-4 py-3 text-sm font-bold text-gray-500">
                      Buscando proveedores...
                    </p>
                  ) : proveedores.length > 0 ? (
                    proveedores.map((proveedor) => (
                      <button
                        key={proveedor.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void seleccionarProveedor(proveedor)}
                        className="block w-full px-4 py-3 text-left text-sm font-bold hover:bg-maruxa-crema"
                      >
                        {proveedor.razon_social}
                      </button>
                    ))
                  ) : (
                    <p className="px-4 py-3 text-sm font-bold text-gray-500">
                      No se encontraron proveedores.
                    </p>
                  )}
                </div>
              )}
            </div>

            {proveedorId && (
              <label className="mt-3 flex max-w-xl items-center gap-3 rounded-2xl border border-maruxa-rojo/15 bg-[#FFF8ED] px-4 py-3 text-sm font-black text-maruxa-chocolate">
                <input
                  type="checkbox"
                  checked={precioIvaIncluido}
                  onChange={(e) => cambiarPrecioIvaProveedor(e.target.checked)}
                  className="h-4 w-4 accent-maruxa-rojo"
                />
                Precio IVA incluido
                <span className="ml-auto text-xs font-bold text-maruxa-cafe/60">
                  {precioIvaIncluido
                    ? 'Ingresar valor bruto'
                    : 'Ingresar valor neto + IVA'}
                </span>
              </label>
            )}

            <div className="mt-6 rounded-[28px] bg-maruxa-crema p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h3 className="text-xl font-black text-maruxa-chocolate">
                  Detalle de compra
                </h3>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={agregarItem}
                    className="rounded-full bg-red-700 px-6 py-3 text-sm font-black text-white shadow-lg"
                  >
                    + Agregar producto
                  </button>
                </div>
              </div>

              {mostrarCrearProducto && (
                <div className="mt-5 rounded-[24px] border border-red-700/20 bg-white p-4">
                  <h4 className="text-lg font-black text-maruxa-chocolate">
                    Crear producto para esta compra
                  </h4>

                  <div className="mt-4 grid gap-4 md:grid-cols-12">
                    <label className="grid gap-1 md:col-span-2">
                      <span className="text-[11px] font-black uppercase tracking-wide text-maruxa-cafe/60">
                        Codigo
                      </span>
                      <input
                        value={nuevoProducto.codigo}
                        onChange={(e) =>
                          setNuevoProducto({
                            ...nuevoProducto,
                            codigo: e.target.value,
                          })
                        }
                        placeholder="Codigo"
                        className="w-full rounded-2xl border px-4 py-3 font-bold uppercase"
                      />
                      <span className="text-[11px] font-bold text-maruxa-cafe/60">
                        Sugerido: {codigoSugeridoNuevoProducto}
                      </span>
                    </label>

                    <label className="relative grid gap-1 md:col-span-5">
                      <span className="text-[11px] font-black uppercase tracking-wide text-maruxa-cafe/60">
                        Nombre
                      </span>
                      <input
                        value={nuevoProducto.nombre}
                        onChange={(e) =>
                          setNuevoProducto({
                            ...nuevoProducto,
                            nombre: e.target.value,
                          })
                        }
                        placeholder="Nombre"
                        className="w-full rounded-2xl border px-4 py-3 font-bold"
                      />

                      {nuevoProducto.nombre.trim().length >= 2 && (
                        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border bg-white shadow-xl">
                          {buscandoNuevoProducto ? (
                            <div className="px-4 py-3 text-sm font-black text-gray-500">
                              Buscando...
                            </div>
                          ) : coincidenciasNuevoProducto.length > 0 ? (
                            coincidenciasNuevoProducto.map((producto) => (
                              <button
                                key={producto.id}
                                type="button"
                                onClick={() => {
                                  const itemExistente = {
                                      producto_id: String(producto.id),
                                      busqueda_producto: `${producto.nombre} - ${producto.tipo_producto}`,
                                      cantidad: '1',
                                      costo_unitario: '',
                                      costo_total: '',
                                      margen_porcentaje: '',
                                      tipo_margen: 'markup' as const,
                                      precio_venta: '',
                                      precio_listado: true,
                                      texto_listado_1: '',
                                      texto_listado_2: '',
                                    };
                                  setItems((actuales) =>
                                    indiceItemCreacion === null
                                      ? [...actuales, itemExistente]
                                      : actuales.map((item, indice) =>
                                          indice === indiceItemCreacion
                                            ? itemExistente
                                            : item
                                        )
                                  );
                                  setIndiceItemCreacion(null);
                                  setMostrarCrearProducto(false);
                                  setNuevoProducto({
                                    codigo: '',
                                    nombre: '',
                                    tipo_producto: 'ingrediente',
                                    familia_id: '',
                                    unidad_base: 'KG',
                                    costo_unitario: '',
                                    stock_actual: '',
                                    controla_stock: true,
                                  });
                                }}
                                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-bold hover:bg-maruxa-crema"
                              >
                                <span>
                                  {producto.codigo ? `${producto.codigo} | ` : ''}
                                  {producto.nombre}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {producto.tipo_producto} - stock{' '}
                                  {numero(producto.stock_actual).toLocaleString('es-CL')}
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm font-black text-red-700">
                              No existe. Puedes crearlo abajo.
                            </div>
                          )}
                        </div>
                      )}
                    </label>

                    <label className="grid gap-1 md:col-span-2">
                      <span className="text-[11px] font-black uppercase tracking-wide text-maruxa-cafe/60">
                        Tipo
                      </span>
                      <select
                        value={nuevoProducto.tipo_producto}
                        onChange={(e) =>
                          setNuevoProducto({
                            ...nuevoProducto,
                            tipo_producto: e.target.value as TipoProductoCompra,
                          })
                        }
                        className="rounded-2xl border px-4 py-3 font-bold"
                      >
                        <option value="producto">Producto</option>
                        <option value="ingrediente">Ingrediente</option>
                        <option value="envase">Envase</option>
                      </select>
                    </label>

                    <label className="grid gap-1 md:col-span-3">
                      <span className="text-[11px] font-black uppercase tracking-wide text-maruxa-cafe/60">
                        Familia
                      </span>
                      <select
                        value={nuevoProducto.familia_id}
                        onChange={(e) =>
                          setNuevoProducto({
                            ...nuevoProducto,
                            familia_id: e.target.value,
                          })
                        }
                        className="rounded-2xl border px-4 py-3 font-bold"
                      >
                        <option value="">Familia</option>
                        {familias.map((familia) => (
                          <option key={familia.id} value={familia.id}>
                            {familia.nombre}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1 md:col-span-2">
                      <span className="text-[11px] font-black uppercase tracking-wide text-maruxa-cafe/60">
                        Unidad
                      </span>
                      <select
                        value={nuevoProducto.unidad_base}
                        onChange={(e) =>
                          setNuevoProducto({
                            ...nuevoProducto,
                            unidad_base: e.target.value,
                          })
                        }
                        className="rounded-2xl border px-4 py-3 font-bold"
                      >
                        <option value="KG">KG</option>
                        <option value="GR">GR</option>
                        <option value="LT">LT</option>
                        <option value="ML">ML</option>
                        <option value="UN">UN</option>
                      </select>
                    </label>

                    <label className="grid gap-1 md:col-span-3">
                      <span className="text-[11px] font-black uppercase tracking-wide text-maruxa-cafe/60">
                        Costo unitario
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={entradaPeso(nuevoProducto.costo_unitario)}
                        onChange={(e) =>
                          setNuevoProducto({
                            ...nuevoProducto,
                            costo_unitario: valorPesoEntrada(e.target.value),
                          })
                        }
                        placeholder="$0"
                        className="rounded-2xl border px-4 py-3 text-right font-bold"
                      />
                    </label>

                    <label className="grid gap-1 md:col-span-3">
                      <span className="text-[11px] font-black uppercase tracking-wide text-maruxa-cafe/60">
                        Stock
                      </span>
                      <input
                        type="number"
                        value={nuevoProducto.stock_actual}
                        onChange={(e) =>
                          setNuevoProducto({
                            ...nuevoProducto,
                            stock_actual: e.target.value,
                          })
                        }
                        placeholder="0"
                        className="rounded-2xl border px-4 py-3 text-right font-bold"
                      />
                    </label>

                  </div>

                  <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <label className="flex items-center gap-3 text-sm font-black text-maruxa-chocolate">
                      <input
                        type="checkbox"
                        checked={nuevoProducto.controla_stock}
                        onChange={(e) =>
                          setNuevoProducto({
                            ...nuevoProducto,
                            controla_stock: e.target.checked,
                          })
                        }
                      />
                      Controla stock
                    </label>

                    <button
                      type="button"
                      onClick={crearProductoRapido}
                      className="rounded-full bg-red-700 px-8 py-3 text-sm font-black text-white shadow-lg"
                    >
                      Crear producto
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-3">
                {items.map((item, index) => {
                  const producto = productos.find((p) => String(p.id) === String(item.producto_id));
                  const familiaProducto = familias.find(
                    (familia) => familia.id === producto?.familia_id
                  );
                  const historialCargado = producto
                    ? ultimasCompras[producto.id]
                    : undefined;
                  const historialVisible: UltimaCompraProducto[] =
                    historialCargado?.length
                      ? historialCargado
                      : historialCargado &&
                          producto &&
                          (numero(producto.costo_unitario) > 0 ||
                            numero(producto.precio) > 0)
                        ? [
                            {
                              producto_id: producto.id,
                              fecha: new Date().toISOString(),
                              precio: numero(producto.costo_unitario),
                              precio_venta: numero(producto.precio) || null,
                              margen_porcentaje:
                                numero(
                                  producto.usar_configuracion_familia === false
                                    ? producto.margen_personalizado
                                    : familiaProducto?.margen_porcentaje
                                ) || null,
                              origen: 'ficha_actual',
                            },
                          ]
                        : [];
                  const impuestosItem = desgloseIva(
                    numero(item.costo_unitario),
                    ivaPorcentaje,
                    precioIvaIncluido
                  );
                  const busquedaNormalizada = normalizarTexto(item.busqueda_producto);
                  const productosFiltrados =
                    busquedaNormalizada.length < 2
                      ? []
                      : productos
                          .filter((productoItem) =>
                            normalizarTexto(
                              `${productoItem.codigo || ''} ${productoItem.nombre} ${productoItem.tipo_producto}`
                            ).includes(busquedaNormalizada)
                          )
                          .slice(0, 8);

                  return (
                    <div
                      key={index}
                      className="relative grid gap-3 rounded-2xl border border-maruxa-cafe/10 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-9"
                    >
                      <div className="relative z-20 grid min-w-0 gap-1 xl:col-span-2">
                        <span className="text-[11px] font-black uppercase tracking-wide text-maruxa-cafe/60">
                          Producto
                        </span>
                        <input
                          value={item.busqueda_producto}
                          onChange={(e) =>
                            actualizarItem(index, 'busqueda_producto', e.target.value)
                          }
                          placeholder="Buscar producto..."
                          className="w-full rounded-xl border px-3 py-2 text-sm font-bold"
                        />

                        {!item.producto_id && item.busqueda_producto && (
                          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border bg-white shadow-xl">
                            {productosFiltrados.length === 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setNuevoProducto({
                                    ...nuevoProducto,
                                    nombre: item.busqueda_producto,
                                  });
                                  setIndiceItemCreacion(index);
                                  setMostrarCrearProducto(true);
                                }}
                                className="w-full px-3 py-2 text-left text-xs font-black text-red-700 hover:bg-red-50"
                              >
                                No existe. Crear "{item.busqueda_producto}"
                              </button>
                            ) : (
                              productosFiltrados.map((productoItem) => (
                                <button
                                  key={productoItem.id}
                                  type="button"
                                  onClick={() =>
                                    actualizarItem(
                                      index,
                                      'producto_id',
                                      String(productoItem.id)
                                    )
                                  }
                                  className="flex w-full flex-col gap-1 px-3 py-2 text-left text-xs font-bold hover:bg-maruxa-crema"
                                >
                                  <span className="flex w-full items-center justify-between gap-3">
                                    <span>
                                      {productoItem.codigo
                                        ? `${productoItem.codigo} | `
                                        : ''}
                                      {productoItem.nombre}
                                    </span>
                                    <span className="text-gray-500">
                                      {productoItem.tipo_producto}
                                    </span>
                                  </span>
                                  <span className="text-[11px] font-bold text-gray-500">
                                    Ultimas compras:{' '}
                                    {ultimasCompras[productoItem.id]?.length
                                      ? ultimasCompras[productoItem.id]
                                          .map(
                                            (compra) =>
                                              `${formatearFecha(compra.fecha)} ${dinero(compra.precio)}`
                                          )
                                          .join(' | ')
                                      : 'sin historial'}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      <label className="grid min-w-0 gap-1">
                        <span className="text-[11px] font-black uppercase tracking-wide text-maruxa-cafe/60">
                          Valor compra
                          {precioIvaIncluido ? ' bruto' : ' neto'}
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={entradaPeso(item.costo_unitario)}
                          onChange={(e) =>
                            actualizarItem(
                              index,
                              'costo_unitario',
                              valorPesoEntrada(e.target.value)
                            )
                          }
                          placeholder="$0"
                          title="El IVA se aplicará según la configuración del proveedor"
                          className="w-full min-w-0 rounded-xl border px-3 py-2 text-right text-sm font-bold"
                        />
                      </label>

                      <div className="grid min-w-0 gap-1">
                        <span className="text-[11px] font-black uppercase tracking-wide text-maruxa-cafe/60">
                          Neto
                        </span>
                        <div className="flex items-center justify-end rounded-xl border border-maruxa-cafe/10 bg-maruxa-crema/60 px-3 py-2 text-sm font-black text-maruxa-chocolate">
                          {dinero(impuestosItem.neto)}
                        </div>
                      </div>

                      <div className="grid min-w-0 gap-1">
                        <span className="text-[11px] font-black uppercase tracking-wide text-maruxa-cafe/60">
                          IVA
                        </span>
                        <div className="flex items-center justify-end rounded-xl border border-maruxa-cafe/10 bg-maruxa-crema/60 px-3 py-2 text-sm font-black text-maruxa-chocolate">
                          {dinero(impuestosItem.iva)}
                        </div>
                      </div>

                      <div className="grid min-w-0 gap-1">
                        <span className="text-[11px] font-black uppercase tracking-wide text-maruxa-cafe/60">
                          Total
                        </span>
                        <div className="flex items-center justify-end rounded-xl border border-maruxa-rojo/15 bg-red-50 px-3 py-2 text-sm font-black text-maruxa-rojo">
                          {dinero(impuestosItem.total)}
                        </div>
                      </div>

                      <label className="grid min-w-0 gap-1">
                        <span className="text-[11px] font-black uppercase tracking-wide text-maruxa-cafe/60">
                          Margen
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={entradaPorcentaje(item.margen_porcentaje)}
                          onChange={(e) =>
                            actualizarItem(
                              index,
                              'margen_porcentaje',
                              valorPorcentajeEntrada(e.target.value)
                            )
                          }
                          placeholder="0%"
                          className="w-full min-w-0 rounded-xl border px-3 py-2 text-right text-sm font-bold"
                        />
                      </label>

                      <label className="grid min-w-0 gap-1">
                        <span className="text-[11px] font-black uppercase tracking-wide text-maruxa-cafe/60">
                          Precio venta
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={entradaPeso(item.precio_venta)}
                          onChange={(e) =>
                            actualizarItem(
                              index,
                              'precio_venta',
                              valorPesoEntrada(e.target.value)
                            )
                          }
                          placeholder="$0"
                          className="w-full min-w-0 rounded-xl border px-3 py-2 text-right text-sm font-black text-maruxa-rojo"
                        />
                      </label>

                      {producto && (
                        <section className="rounded-2xl border-2 border-maruxa-rojo/20 bg-[#FFF8ED] p-4 md:col-span-2 xl:col-span-9">
                          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-maruxa-rojo/15 pb-3">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[.2em] text-maruxa-rojo">
                                Historial de precios
                              </p>
                              <h4 className="mt-1 font-black text-maruxa-chocolate">
                                Últimos valores ingresados para {producto.nombre}
                              </h4>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-maruxa-cafe/60">
                              Registro histórico
                            </span>
                          </div>

                          {historialCargado === undefined ? (
                            <p className="py-4 text-sm font-bold text-maruxa-cafe/60">
                              Cargando historial...
                            </p>
                          ) : historialVisible.length === 0 ? (
                            <p className="py-4 text-sm font-bold text-maruxa-cafe/60">
                              Este producto todavía no tiene valores anteriores registrados.
                            </p>
                          ) : (
                            <div className="mt-3 overflow-x-auto">
                              <table className="w-full min-w-[560px] text-sm">
                                <thead>
                                  <tr className="text-left text-[11px] font-black uppercase tracking-wide text-maruxa-cafe/60">
                                    <th className="px-3 py-2">Fecha</th>
                                    <th className="px-3 py-2 text-right">Valor compra</th>
                                    <th className="px-3 py-2 text-right">Margen</th>
                                    <th className="px-3 py-2 text-right">Precio venta</th>
                                    <th className="px-3 py-2 text-right">Acciones</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {historialVisible.map((historial, historialIndex) => (
                                    <tr
                                      key={`${historial.fecha}-${historialIndex}`}
                                      className="border-t border-maruxa-cafe/10 bg-white/70"
                                    >
                                      <td className="px-3 py-2 font-bold">
                                        {historial.origen === 'ficha_actual' &&
                                        fichaEditandoId === producto.id ? (
                                          <input
                                            type="date"
                                            value={fichaEditando.fecha}
                                            onChange={(e) =>
                                              setFichaEditando((actual) => ({
                                                ...actual,
                                                fecha: e.target.value,
                                              }))
                                            }
                                            className="w-36 rounded-lg border px-2 py-1 text-xs font-bold"
                                          />
                                        ) : (
                                          formatearFecha(historial.fecha)
                                        )}
                                        {historial.origen === 'ficha_actual' && (
                                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-800">
                                            Ficha vigente
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-right font-black">
                                        {historial.origen === 'ficha_actual' &&
                                        fichaEditandoId === producto.id ? (
                                          <input
                                            value={entradaPeso(fichaEditando.costo)}
                                            onChange={(e) =>
                                              setFichaEditando((actual) => ({
                                                ...actual,
                                                costo: valorPesoEntrada(e.target.value),
                                              }))
                                            }
                                            inputMode="numeric"
                                            className="w-24 rounded-lg border px-2 py-1 text-right text-xs font-black"
                                          />
                                        ) : (
                                          dinero(historial.precio)
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-right font-bold">
                                        {historial.origen === 'ficha_actual' &&
                                        fichaEditandoId === producto.id ? (
                                          <input
                                            value={entradaPorcentaje(fichaEditando.margen)}
                                            onChange={(e) =>
                                              setFichaEditando((actual) => ({
                                                ...actual,
                                                margen: valorPorcentajeEntrada(e.target.value),
                                              }))
                                            }
                                            inputMode="decimal"
                                            className="w-20 rounded-lg border px-2 py-1 text-right text-xs font-bold"
                                          />
                                        ) : historial.margen_porcentaje === null ? (
                                          'No registrado'
                                        ) : (
                                          entradaPorcentaje(historial.margen_porcentaje)
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-right font-black text-maruxa-rojo">
                                        {historial.origen === 'ficha_actual' &&
                                        fichaEditandoId === producto.id ? (
                                          <input
                                            value={entradaPeso(fichaEditando.precioVenta)}
                                            onChange={(e) =>
                                              setFichaEditando((actual) => ({
                                                ...actual,
                                                precioVenta: valorPesoEntrada(e.target.value),
                                              }))
                                            }
                                            inputMode="numeric"
                                            className="w-24 rounded-lg border px-2 py-1 text-right text-xs font-black text-maruxa-rojo"
                                          />
                                        ) : historial.precio_venta === null ? (
                                          'No registrado'
                                        ) : (
                                          dinero(historial.precio_venta)
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        {historial.origen === 'ficha_actual' &&
                                          (fichaEditandoId === producto.id ? (
                                            <div className="flex justify-end gap-1">
                                              <button
                                                type="button"
                                                onClick={() => setFichaEditandoId(null)}
                                                className="rounded-lg border bg-white px-2 py-1 text-[11px] font-black"
                                              >
                                                Cancelar
                                              </button>
                                              <button
                                                type="button"
                                                disabled={guardandoFicha}
                                                onClick={() => guardarFichaVigente(producto)}
                                                className="rounded-lg bg-maruxa-rojo px-2 py-1 text-[11px] font-black text-white disabled:opacity-50"
                                              >
                                                {guardandoFicha ? 'Guardando...' : 'Guardar'}
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                editarFichaVigente(
                                                  producto,
                                                  numero(familiaProducto?.margen_porcentaje)
                                                )
                                              }
                                              className="rounded-lg border border-maruxa-rojo/30 bg-white px-3 py-1 text-[11px] font-black text-maruxa-rojo"
                                            >
                                              Modificar
                                            </button>
                                          ))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </section>
                      )}

                        <button
                          type="button"
                          onClick={() => eliminarItem(index)}
                          className="self-end justify-self-stretch rounded-xl border border-red-300 bg-red-50 px-2 py-2.5 text-xs font-black text-red-700 md:col-span-2 xl:col-span-1 xl:col-start-9 xl:row-start-1"
                        >
                          Eliminar
                        </button>

                      {producto && productoEditandoId === producto.id && (
                        <div className="grid gap-4 rounded-2xl border border-red-100 bg-red-50/60 p-4 md:col-span-2 xl:col-span-9">
                          <div className="grid gap-3 md:grid-cols-12">
                            <label className="grid gap-1 md:col-span-2">
                              <span className="text-[11px] font-black uppercase text-maruxa-cafe/60">
                                Codigo
                              </span>
                              <input
                                value={productoEditando.codigo}
                                onChange={(e) =>
                                  setProductoEditando({
                                    ...productoEditando,
                                    codigo: e.target.value,
                                  })
                                }
                                className="rounded-xl border px-3 py-2 text-sm font-bold uppercase"
                              />
                            </label>

                            <label className="grid gap-1 md:col-span-5">
                              <span className="text-[11px] font-black uppercase text-maruxa-cafe/60">
                                Nombre
                              </span>
                              <input
                                value={productoEditando.nombre}
                                onChange={(e) =>
                                  setProductoEditando({
                                    ...productoEditando,
                                    nombre: e.target.value,
                                  })
                                }
                                className="rounded-xl border px-3 py-2 text-sm font-bold"
                              />
                            </label>

                            <label className="grid gap-1 md:col-span-2">
                              <span className="text-[11px] font-black uppercase text-maruxa-cafe/60">
                                Tipo
                              </span>
                              <select
                                value={productoEditando.tipo_producto}
                                onChange={(e) =>
                                  setProductoEditando({
                                    ...productoEditando,
                                    tipo_producto: e.target.value as TipoProductoCompra,
                                  })
                                }
                                className="rounded-xl border px-3 py-2 text-sm font-bold"
                              >
                                <option value="producto">Producto</option>
                                <option value="ingrediente">Ingrediente</option>
                                <option value="envase">Envase</option>
                              </select>
                            </label>

                            <label className="grid gap-1 md:col-span-3">
                              <span className="text-[11px] font-black uppercase text-maruxa-cafe/60">
                                Familia
                              </span>
                              <select
                                value={productoEditando.familia_id}
                                onChange={(e) =>
                                  setProductoEditando({
                                    ...productoEditando,
                                    familia_id: e.target.value,
                                  })
                                }
                                className="rounded-xl border px-3 py-2 text-sm font-bold"
                              >
                                <option value="">Sin familia</option>
                                {familias.map((familia) => (
                                  <option key={familia.id} value={familia.id}>
                                    {familia.nombre}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <div className="grid gap-3 md:grid-cols-12">
                            <label className="grid gap-1 md:col-span-2">
                              <span className="text-[11px] font-black uppercase text-maruxa-cafe/60">
                                Unidad
                              </span>
                              <select
                                value={productoEditando.unidad_base}
                                onChange={(e) =>
                                  setProductoEditando({
                                    ...productoEditando,
                                    unidad_base: e.target.value,
                                  })
                                }
                                className="rounded-xl border px-3 py-2 text-sm font-bold"
                              >
                                <option value="KG">KG</option>
                                <option value="GR">GR</option>
                                <option value="LT">LT</option>
                                <option value="ML">ML</option>
                                <option value="UN">UN</option>
                              </select>
                            </label>

                            <label className="grid gap-1 md:col-span-2">
                              <span className="text-[11px] font-black uppercase text-maruxa-cafe/60">
                                Costo
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={entradaPeso(productoEditando.costo_unitario)}
                                onChange={(e) =>
                                  setProductoEditando({
                                    ...productoEditando,
                                    costo_unitario: valorPesoEntrada(e.target.value),
                                  })
                                }
                                className="rounded-xl border px-3 py-2 text-right text-sm font-bold"
                              />
                            </label>

                            <label className="grid gap-1 md:col-span-2">
                              <span className="text-[11px] font-black uppercase text-maruxa-cafe/60">
                                Stock
                              </span>
                              <input
                                type="number"
                                value={productoEditando.stock_actual}
                                onChange={(e) =>
                                  setProductoEditando({
                                    ...productoEditando,
                                    stock_actual: e.target.value,
                                  })
                                }
                                className="rounded-xl border px-3 py-2 text-right text-sm font-bold"
                              />
                            </label>

                            <label className="flex items-center gap-2 self-end text-xs font-black text-maruxa-chocolate md:col-span-2">
                              <input
                                type="checkbox"
                                checked={productoEditando.controla_stock}
                                onChange={(e) =>
                                  setProductoEditando({
                                    ...productoEditando,
                                    controla_stock: e.target.checked,
                                  })
                                }
                              />
                              Controla stock
                            </label>

                            <div className="flex flex-wrap justify-end gap-2 self-end md:col-span-4">
                              <button
                                type="button"
                                onClick={cerrarEdicionProducto}
                                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-black"
                              >
                                Cancelar
                              </button>

                              <button
                                type="button"
                                onClick={guardarProductoEditado}
                                disabled={guardandoProductoEditado}
                                className="rounded-full bg-red-700 px-5 py-2 text-xs font-black text-white disabled:opacity-50"
                              >
                                {guardandoProductoEditado ? 'Guardando...' : 'Guardar producto'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-4 rounded-[28px] bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-3xl font-black text-maruxa-chocolate">
                  Total compra: {dinero(totalCompra)}
                </p>
                <p className="mt-1 text-xs font-bold text-maruxa-cafe/70">
                  Suma de los productos ingresados. La factura electrónica se
                  incorporará desde su integración correspondiente.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={calcularVariacionesPrevias}
                  className="rounded-full border-2 border-red-700 bg-white px-8 py-4 font-black text-red-700 shadow-lg transition hover:bg-red-50"
                >
                  Ver variación de costos
                </button>

                <button
                  type="button"
                  onClick={guardarCompra}
                  disabled={guardando}
                  className="rounded-full bg-red-700 px-8 py-4 font-black text-white shadow-lg disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : 'Guardar compra'}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {mostrarVariaciones && (
        <section className="mt-8 rounded-[34px] bg-white p-6 shadow-premium">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-maruxa-chocolate">
                Variación de costos
              </h2>

              <p className="mt-1 text-sm font-bold text-maruxa-cafe/70">
                Muestra cómo cambiará el costo promedio ponderado de cada producto de la compra.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMostrarVariaciones(false)}
              className="rounded-full border border-gray-300 bg-white px-5 py-3 text-sm font-black"
            >
              Ocultar
            </button>
          </div>

          {variacionesCompra.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-maruxa-crema p-4 font-bold text-maruxa-cafe/70">
              No hay variaciones para mostrar.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-2xl border">
              <table className="w-full text-sm">
                <thead className="bg-red-700 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Producto</th>
                    <th className="px-4 py-3 text-right">Cantidad</th>
                    <th className="px-4 py-3 text-right">Promedio anterior</th>
                    <th className="px-4 py-3 text-right">Costo compra</th>
                    <th className="px-4 py-3 text-right">Nuevo promedio</th>
                    <th className="px-4 py-3 text-right">Variación</th>
                  </tr>
                </thead>

                <tbody>
                  {variacionesCompra.map((item) => (
                    <tr key={item.producto_id} className="border-b last:border-none hover:bg-maruxa-crema/40">
                      <td className="px-4 py-3 font-bold">{item.nombre}</td>

                      <td className="px-4 py-3 text-right">
                        {item.cantidad.toLocaleString('es-CL', {
                          maximumFractionDigits: 4,
                        })}{' '}
                        {item.unidad_base || ''}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {dinero(item.costo_anterior)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {dinero(item.costo_compra)}
                      </td>

                      <td className="px-4 py-3 text-right font-black">
                        {dinero(item.costo_nuevo)}
                      </td>

                      <td
                        className={`px-4 py-3 text-right font-black ${
                          item.variacion_porcentaje > 0
                            ? 'text-red-700'
                            : item.variacion_porcentaje < 0
                              ? 'text-green-700'
                              : 'text-gray-600'
                        }`}
                      >
                        {item.variacion_porcentaje > 0 ? '+' : ''}
                        {item.variacion_porcentaje.toLocaleString('es-CL', {
                          maximumFractionDigits: 2,
                        })}
                        %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-8 rounded-[28px] border border-maruxa-rojo/10 bg-maruxa-crema p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-xl font-black text-maruxa-chocolate">
                  Recetas afectadas
                </h3>

                <p className="mt-1 text-sm font-bold text-maruxa-cafe/70">
                  Estimación del impacto en recetas que usan los productos comprados.
                </p>
              </div>

              {cargandoRecetasAfectadas && (
                <p className="text-sm font-black text-maruxa-rojo">
                  Calculando...
                </p>
              )}
            </div>

            {!cargandoRecetasAfectadas && recetasAfectadas.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-white p-4 font-bold text-maruxa-cafe/70">
                No se encontraron recetas vinculadas a estos productos.
              </p>
            ) : (
              recetasAfectadas.length > 0 && (
                <div className="mt-5 overflow-x-auto rounded-2xl border bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-maruxa-chocolate text-white">
                      <tr>
                        <th className="px-4 py-3 text-left">Producto terminado</th>
                        <th className="px-4 py-3 text-left">Receta</th>
                        <th className="px-4 py-3 text-left">Insumos afectados</th>
                        <th className="px-4 py-3 text-right">Costo kg</th>
                        <th className="px-4 py-3 text-right">Costo unidad</th>
                        <th className="px-4 py-3 text-right">Precio sugerido</th>
                        <th className="px-4 py-3 text-right">Variación</th>
                      </tr>
                    </thead>

                    <tbody>
                      {recetasAfectadas.map((receta) => (
                        <tr
                          key={receta.receta_id}
                          className="border-b last:border-none hover:bg-maruxa-crema/40"
                        >
                          <td className="px-4 py-3 font-black">
                            {receta.producto_nombre}
                          </td>

                          <td className="px-4 py-3 font-bold">
                            {receta.receta_nombre}
                          </td>

                          <td className="px-4 py-3">
                            {receta.ingredientes_afectados.join(', ')}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {dinero(receta.costo_kg_anterior)}
                            <span className="mx-1 text-gray-400">-&gt;</span>
                            <b>{dinero(receta.costo_kg_nuevo)}</b>
                          </td>

                          <td className="px-4 py-3 text-right">
                            {dinero(receta.costo_unidad_anterior)}
                            <span className="mx-1 text-gray-400">-&gt;</span>
                            <b>{dinero(receta.costo_unidad_nuevo)}</b>
                          </td>

                          <td className="px-4 py-3 text-right">
                            {dinero(receta.precio_sugerido_anterior)}
                            <span className="mx-1 text-gray-400">-&gt;</span>
                            <b>{dinero(receta.precio_sugerido_nuevo)}</b>
                          </td>

                          <td
                            className={`px-4 py-3 text-right font-black ${
                              receta.variacion_porcentaje > 0
                                ? 'text-red-700'
                                : receta.variacion_porcentaje < 0
                                  ? 'text-green-700'
                                  : 'text-gray-600'
                            }`}
                          >
                            {receta.variacion_porcentaje > 0 ? '+' : ''}
                            {receta.variacion_porcentaje.toLocaleString('es-CL', {
                              maximumFractionDigits: 2,
                            })}
                            %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </section>
      )}
    </>
  );
}
