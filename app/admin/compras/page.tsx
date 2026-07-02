'use client';

import Link from 'next/link';
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
  controla_stock: boolean | null;
};

type UltimaCompraProducto = {
  producto_id: number;
  fecha: string;
  precio: number;
};

type ProveedorCompra = {
  id: string;
  razon_social: string;
  nombre_fantasia: string | null;
  rut: string | null;
};

type FamiliaProducto = {
  id: string;
  nombre: string;
  activo: boolean;
  mostrar_catalogo: boolean | null;
};

type ItemCompra = {
  producto_id: string;
  busqueda_producto: string;
  cantidad: string;
  costo_unitario: string;
  costo_total: string;
};

type TipoProductoCompra = 'producto' | 'ingrediente' | 'envase';

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

function numero(valor: string | number | null | undefined) {
  return Number(String(valor ?? 0).replace(',', '.')) || 0;
}

function dinero(valor: number) {
  return `$${Math.round(Number(valor || 0)).toLocaleString('es-CL')}`;
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
  const [familias, setFamilias] = useState<FamiliaProducto[]>([]);
  const [proveedor, setProveedor] = useState('');
  const [mostrarProveedores, setMostrarProveedores] = useState(false);
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [totalDocumento, setTotalDocumento] = useState('');
  const [observacion, setObservacion] = useState('');
  const [items, setItems] = useState<ItemCompra[]>([]);
  const [resultadosBusqueda, setResultadosBusqueda] = useState<Record<number, Producto[]>>({});
  const [ultimasCompras, setUltimasCompras] = useState<Record<number, UltimaCompraProducto[]>>({});
  const [mostrarCrearProducto, setMostrarCrearProducto] = useState(false);
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
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [variacionesCompra, setVariacionesCompra] = useState<VariacionCosto[]>([]);
  const [mostrarVariaciones, setMostrarVariaciones] = useState(false);
  const [recetasAfectadas, setRecetasAfectadas] = useState<RecetaAfectada[]>([]);
  const [cargandoRecetasAfectadas, setCargandoRecetasAfectadas] = useState(false);

  const totalCompra = useMemo(() => {
    return items.reduce((total, item) => {
      return total + numero(item.cantidad) * numero(item.costo_unitario);
    }, 0);
  }, [items]);
  const diferenciaDocumento = numero(totalDocumento) - totalCompra;

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

  const proveedoresFiltrados = useMemo(() => {
    const termino = normalizarTexto(proveedor);

    if (!termino) return proveedores.slice(0, 40);

    return proveedores
      .filter((item) =>
        normalizarTexto(
          `${item.razon_social} ${item.nombre_fantasia || ''} ${item.rut || ''}`
        ).includes(termino)
      )
      .slice(0, 40);
  }, [proveedor, proveedores]);

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

    const [
      { data, error },
      { data: proveedoresData },
      { data: familiasData },
    ] = await Promise.all([
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
        controla_stock
      `)
      .eq('empresa_id', empresa.id)
      .in('tipo_producto', ['producto', 'ingrediente', 'envase'])
      .eq('activo', true)
      .order('nombre', { ascending: true }),
      supabase
        .from('proveedores')
        .select('id, razon_social, nombre_fantasia, rut')
        .eq('empresa_id', empresa.id)
        .eq('activo', true)
        .order('razon_social', { ascending: true }),
      supabase
        .from('familias_productos')
        .select('id,nombre,activo,mostrar_catalogo')
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
    setProveedores((proveedoresData as ProveedorCompra[]) || []);
    setFamilias((familiasData as FamiliaProducto[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    cargarProductos();
  }, []);

  async function cargarUltimasCompras(productoIds: number[]) {
    const idsPendientes = [...new Set(productoIds)].filter(
      (id) => id && !ultimasCompras[id]
    );

    if (idsPendientes.length === 0) return;

    const empresa = await obtenerEmpresaActual();

    if (!empresa) return;

    const { data, error } = await supabase
      .from('producto_costos_historial')
      .select('producto_id,created_at,costo_compra')
      .eq('empresa_id', empresa.id)
      .in('producto_id', idsPendientes)
      .order('created_at', { ascending: false })
      .limit(idsPendientes.length * 6);

    if (error) return;

    const agrupadas = new Map<number, UltimaCompraProducto[]>();

    for (const item of data || []) {
      const productoId = Number(item.producto_id);
      const actuales = agrupadas.get(productoId) || [];

      if (actuales.length >= 2) continue;

      actuales.push({
        producto_id: productoId,
        fecha: item.created_at,
        precio: numero(item.costo_compra),
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
    setItems([
      ...items,
      {
        producto_id: '',
        busqueda_producto: '',
        cantidad: '',
        costo_unitario: '',
        costo_total: '',
      },
    ]);
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
          const costoUnitario = item.costo_unitario || String(producto?.costo_unitario || '');
          const totalLinea =
            numero(item.cantidad) > 0 && numero(costoUnitario) > 0
              ? String(numero(item.cantidad) * numero(costoUnitario))
              : item.costo_total;

          return {
            ...item,
            producto_id: valor,
            busqueda_producto: producto
              ? `${producto.nombre} - ${producto.tipo_producto}`
              : item.busqueda_producto,
            costo_unitario: costoUnitario,
            costo_total: totalLinea,
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
                ? String(totalLinea / cantidad)
                : item.costo_unitario,
          };
        }

        if (campo === 'costo_unitario') {
          const cantidad = numero(item.cantidad);
          const costoUnitario = numero(valor);

          return {
            ...item,
            costo_unitario: valor,
            costo_total:
              cantidad > 0 && costoUnitario > 0
                ? String(cantidad * costoUnitario)
                : item.costo_total,
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
                ? String(totalLinea / cantidad)
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
    setItems([
      ...items,
      {
        producto_id: String(productoCreado.id),
        busqueda_producto: `${productoCreado.nombre} - ${productoCreado.tipo_producto}`,
        cantidad: '',
        costo_unitario: String(costo || productoCreado.costo_unitario || ''),
        costo_total: '',
      },
    ]);
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
      const costoUnitario = numero(item.costo_unitario);
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
        costo_unitario: cantidadTotal > 0 ? costoTotal / cantidadTotal : 0,
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

    if (numero(totalDocumento) > 0 && Math.abs(diferenciaDocumento) >= 1) {
      const confirmar = window.confirm(
        `El total de la factura no cuadra. Diferencia: ${dinero(diferenciaDocumento)}. ¿Guardar de todas formas?`
      );

      if (!confirmar) return;
    }

    setGuardando(true);

    const { data: compra, error: errorCompra } = await supabase
      .from('compras')
      .insert({
        empresa_id: empresa.id,
        proveedor,
        numero_documento: numeroDocumento,
        fecha,
        observacion,
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
      const costoUnitario = numero(item.costo_unitario);

      return {
        compra_id: compra.id,
        producto_id: Number(item.producto_id),
        cantidad,
        costo_unitario: costoUnitario,
        costo_total: cantidad * costoUnitario,
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

      if (!producto?.controla_stock) continue;

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
        })
        .eq('id', producto.id);

      if (errorProducto) {
        alert(errorProducto.message);
        setGuardando(false);
        return;
      }

      const { error: errorMovimiento } = await supabase
        .from('movimientos_stock')
        .insert({
          empresa_id: empresa.id,
          producto_id: producto.id,
          tipo_movimiento: 'compra',
          cantidad,
          referencia_tipo: 'compra',
          referencia_id: compra.id,
          observacion: `Compra ${numeroDocumento || ''} ${proveedor || ''}`,
        });

      if (errorMovimiento) {
        alert(errorMovimiento.message);
        setGuardando(false);
        return;
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
          observacion: `Compra ${numeroDocumento || ''} ${proveedor || ''}`.trim(),
        });

      if (errorHistorialCosto) {
        alert(errorHistorialCosto.message);
        setGuardando(false);
        return;
      }
    }

    setProveedor('');
    setNumeroDocumento('');
    setTotalDocumento('');
    setObservacion('');
    setItems([]);
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
            <div className="mt-6 grid gap-4 md:grid-cols-5">
              <label className="relative grid gap-1">
                <input
                  value={proveedor}
                  onFocus={() => setMostrarProveedores(true)}
                  onBlur={() =>
                    setTimeout(() => setMostrarProveedores(false), 150)
                  }
                  onChange={(e) => {
                    setProveedor(e.target.value);
                    setMostrarProveedores(true);
                  }}
                  placeholder="Proveedor"
                  className="rounded-2xl border px-5 py-4 font-bold"
                />

                {mostrarProveedores && (
                  <div className="absolute left-0 right-0 top-[58px] z-30 max-h-80 overflow-y-auto rounded-2xl border bg-white shadow-xl">
                    {proveedoresFiltrados.length > 0 ? (
                      proveedoresFiltrados.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setProveedor(item.razon_social);
                            setMostrarProveedores(false);
                          }}
                          className="flex w-full flex-col px-4 py-3 text-left hover:bg-maruxa-crema"
                        >
                          <span className="text-sm font-black text-maruxa-chocolate">
                            {item.razon_social}
                          </span>
                          <span className="text-xs font-bold text-gray-500">
                            {[item.nombre_fantasia, item.rut]
                              .filter(Boolean)
                              .join(' | ') || 'Proveedor registrado'}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm font-black text-gray-500">
                        No hay proveedores con ese texto.
                      </div>
                    )}
                  </div>
                )}
                <Link
                  href="/admin/proveedores"
                  className="text-xs font-black text-maruxa-rojo hover:underline"
                >
                  Administrar proveedores
                </Link>
              </label>

              <input
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                placeholder="Factura / documento"
                className="rounded-2xl border px-5 py-4 font-bold"
              />

              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="rounded-2xl border px-5 py-4 font-bold"
              />

              <input
                type="number"
                value={totalDocumento}
                onChange={(e) => setTotalDocumento(e.target.value)}
                placeholder="Total factura"
                className="rounded-2xl border px-5 py-4 text-right font-bold"
              />

              <input
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Observación"
                className="rounded-2xl border px-5 py-4 font-bold"
              />
            </div>

            <div className="mt-8 rounded-[28px] bg-maruxa-crema p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h3 className="text-xl font-black text-maruxa-chocolate">
                  Detalle de compra
                </h3>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMostrarCrearProducto((valor) => !valor)}
                    className="rounded-full border-2 border-red-700 bg-white px-6 py-3 text-sm font-black text-red-700 shadow-lg transition hover:bg-red-50"
                  >
                    + Crear producto
                  </button>

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

                  <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
                    <label className="grid gap-1">
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
                        placeholder={codigoSugeridoNuevoProducto}
                        className="rounded-2xl border px-4 py-3 font-bold uppercase"
                      />
                    </label>

                    <div className="rounded-2xl bg-maruxa-crema px-4 py-3 text-sm font-bold text-maruxa-chocolate">
                      <span className="block text-[11px] font-black uppercase tracking-wide text-maruxa-cafe/60">
                        Codigo sugerido
                      </span>
                      {codigoSugeridoNuevoProducto}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_150px_190px_100px_130px_120px_auto]">
                    <div className="relative">
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
                                  setItems([
                                    ...items,
                                    {
                                      producto_id: String(producto.id),
                                      busqueda_producto: `${producto.nombre} - ${producto.tipo_producto}`,
                                      cantidad: '',
                                      costo_unitario: String(producto.costo_unitario || ''),
                                      costo_total: '',
                                    },
                                  ]);
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
                    </div>

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

                    <input
                      type="number"
                      value={nuevoProducto.costo_unitario}
                      onChange={(e) =>
                        setNuevoProducto({
                          ...nuevoProducto,
                          costo_unitario: e.target.value,
                        })
                      }
                      placeholder="Costo unit."
                      className="rounded-2xl border px-4 py-3 text-right font-bold"
                    />

                    <input
                      type="number"
                      value={nuevoProducto.stock_actual}
                      onChange={(e) =>
                        setNuevoProducto({
                          ...nuevoProducto,
                          stock_actual: e.target.value,
                        })
                      }
                      placeholder="Stock"
                      className="rounded-2xl border px-4 py-3 text-right font-bold"
                    />

                    <button
                      type="button"
                      onClick={crearProductoRapido}
                      className="rounded-full bg-red-700 px-6 py-3 text-sm font-black text-white shadow-lg"
                    >
                      Crear
                    </button>
                  </div>

                  <label className="mt-4 flex items-center gap-3 text-sm font-black text-maruxa-chocolate">
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
                </div>
              )}

              <div className="mt-3 hidden grid-cols-[1fr_96px_125px_125px_auto] gap-1.5 px-3 text-[11px] font-black uppercase tracking-wide text-maruxa-cafe/60 md:grid">
                <span>Producto</span>
                <span className="text-right">Cantidad</span>
                <span className="text-right">Precio factura</span>
                <span className="text-right">Total linea</span>
                <span></span>
              </div>

              <div className="mt-1 grid gap-1.5">
                {items.map((item, index) => {
                  const producto = productos.find((p) => String(p.id) === String(item.producto_id));
                  const totalLinea = numero(item.cantidad) * numero(item.costo_unitario);
                  const totalLineaTexto =
                    item.costo_total || (totalLinea > 0 ? String(totalLinea) : '');
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
                      className="grid gap-1.5 rounded-xl bg-white px-3 py-2 md:grid-cols-[1fr_96px_125px_125px_auto]"
                    >
                      <div className="relative">
                        <input
                          value={item.busqueda_producto}
                          onChange={(e) =>
                            actualizarItem(index, 'busqueda_producto', e.target.value)
                          }
                          placeholder="Buscar producto..."
                          className="w-full rounded-xl border px-3 py-2 text-sm font-bold"
                        />

                        {!item.producto_id && item.busqueda_producto && (
                          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border bg-white shadow-xl">
                            {productosFiltrados.length === 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setNuevoProducto({
                                    ...nuevoProducto,
                                    nombre: item.busqueda_producto,
                                  });
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

                      <input
                        type="number"
                        value={item.cantidad}
                        onChange={(e) => actualizarItem(index, 'cantidad', e.target.value)}
                        placeholder="Cantidad"
                        className="rounded-xl border px-3 py-2 text-right text-sm font-bold"
                      />

                      <input
                        type="number"
                        value={item.costo_unitario}
                        onChange={(e) => actualizarItem(index, 'costo_unitario', e.target.value)}
                        placeholder="Precio factura"
                        className="rounded-xl border px-3 py-2 text-right text-sm font-bold"
                      />

                      <input
                        type="number"
                        value={totalLineaTexto}
                        onChange={(e) => actualizarItem(index, 'costo_total', e.target.value)}
                        placeholder="Total linea"
                        className="rounded-xl border px-3 py-2 text-right text-sm font-bold"
                      />

                      <button
                        type="button"
                        onClick={() => eliminarItem(index)}
                        className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-black text-red-700"
                      >
                        Eliminar
                      </button>

                      {producto && (
                        <div className="md:col-span-5 text-[11px] font-bold leading-tight text-gray-500">
                          <p>
                          {producto.codigo && (
                            <>
                              Codigo: {producto.codigo}
                              {' | '}
                            </>
                          )}
                          Stock actual:{' '}
                          {numero(producto.stock_actual).toLocaleString('es-CL')}{' '}
                          {producto.unidad_base || ''}
                          {' · '}
                            Costo actual: {dinero(numero(producto.costo_unitario))}
                          </p>
                          <p className="mt-1">
                            Ultimas compras:{' '}
                            {ultimasCompras[producto.id]?.length
                              ? ultimasCompras[producto.id]
                                  .map(
                                    (compra) =>
                                      `${formatearFecha(compra.fecha)} ${dinero(compra.precio)}`
                                  )
                                  .join(' | ')
                              : 'sin historial'}
                          </p>
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
                {numero(totalDocumento) > 0 && (
                  <p
                    className={`mt-1 text-sm font-black ${
                      Math.abs(diferenciaDocumento) < 1
                        ? 'text-green-700'
                        : 'text-red-700'
                    }`}
                  >
                    Factura: {dinero(numero(totalDocumento))} | Diferencia:{' '}
                    {dinero(diferenciaDocumento)}
                  </p>
                )}
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
