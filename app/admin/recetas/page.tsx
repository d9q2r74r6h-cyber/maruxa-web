'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';



type TipoRecurso = 'ingrediente' | 'envase' | 'mano_obra' | 'receta';
type TipoMargen = 'markup' | 'margen_comercial';
type ModoPrecio = 'desde_margen' | 'desde_precio';
const CLAVE_BORRADOR_RECETA = 'maruxa:receta:borrador:v1';

type Producto = {
  id: number;
  nombre: string;
  categoria: string | null;
  tipo_producto?: string | null;
  unidad_base?: string | null;
  costo_unitario?: number | null;
  familia_id: string | null;
  usar_configuracion_familia?: boolean | null;
  margen_personalizado?: number | null;
  tipo_margen_personalizado?: 'markup' | 'margen_comercial' | null;
  redondeo_personalizado?: number | null;
  iva_porcentaje?: number | null;
  familias_productos?:
    | {
        nombre: string;
        margen_porcentaje: number;
        tipo_margen: 'markup' | 'margen_comercial';
        redondeo_precio: number;
      }
    | {
        nombre: string;
        margen_porcentaje: number;
        tipo_margen: 'markup' | 'margen_comercial';
        redondeo_precio: number;
      }[]
    | null;
};

type Recurso = {
  id: number;
  nombre: string;
  unidad_base: string | null;
  costo_unitario: number | null;
  iva_porcentaje: number | null;
  impuesto_adicional_porcentaje: number | null;
  activo: boolean;
  tipo_producto: TipoRecurso | string;
  receta_id?: string | null;
};

type RecetaItemForm = {
  ingrediente_id: string;
  cantidad: string;
};

type SubproductoForm = {
  producto_id: string;
  nombre: string;
  peso_kg: string;
  margen_porcentaje: string;
};

type RecetaGuardada = {
  id: string;
  nombre: string;
  producto_id: number;
  rendimiento_kg: number;
  unidades_producidas: number;
  costos_indirectos_porcentaje?: number | null;
  activo: boolean;
  productos?:
    | {
        nombre: string;
      }
    | {
        nombre: string;
      }[]
    | null;
};

type DetalleCalculado = RecetaItemForm & {
  recurso?: Recurso;
  cantidad: number;
  costoUnitario: number;
  costoReceta: number;
};

function numero(valor: string | number | null | undefined) {
  return Number(String(valor ?? 0).replace(',', '.')) || 0;
}

function dinero(valor: number) {
  return `$${Math.round(Number(valor || 0)).toLocaleString('es-CL')}`;
}

function nombreTipo(tipo?: string | null) {
  if (tipo === 'receta') return 'Receta';
  if (tipo === 'envase') return 'Envase';
  if (tipo === 'mano_obra') return 'Mano de obra';
  return 'Ingrediente';
}

export default function AdminRecetasPage() {
  const [tabActiva, setTabActiva] = useState<
    'ingredientes' | 'insumos' | 'resumen' | 'subproductos'
  >('ingredientes');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [recursos, setRecursos] = useState<Recurso[]>([]);

  const [productoId, setProductoId] = useState('');
  const [nombre, setNombre] = useState('');
  const [pesoUnidadKg, setPesoUnidadKg] = useState('1');
  const [unidadesProducidas, setUnidadesProducidas] = useState('1');
  const [costosIndirectosPorcentaje, setCostosIndirectosPorcentaje] = useState('0');
  const [modoPrecio, setModoPrecio] = useState<ModoPrecio>('desde_margen');
  const [tipoMargenCalculo, setTipoMargenCalculo] =
    useState<TipoMargen>('markup');
  const [margenCalculo, setMargenCalculo] = useState('0');
  const [precioVentaIngresado, setPrecioVentaIngresado] = useState('');

  const [items, setItems] = useState<RecetaItemForm[]>([]);
  const [insumos, setInsumos] = useState<RecetaItemForm[]>([]);
  const [subproductos, setSubproductos] = useState<SubproductoForm[]>([]);

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardandoPrecio, setGuardandoPrecio] = useState(false);
  const [borradorListo, setBorradorListo] = useState(false);
  const [borradorRecuperado, setBorradorRecuperado] = useState(false);
  const [ivaEmpresa, setIvaEmpresa] = useState(19);

  const [recetas, setRecetas] = useState<RecetaGuardada[]>([]);
  const [recetaEditando, setRecetaEditando] =
    useState<RecetaGuardada | null>(null);

  const recetasComoIngredientes = useMemo(() => {
    return productos
      .filter((producto) =>
        recetas.some(
          (receta) =>
            receta.producto_id === producto.id &&
            receta.id !== recetaEditando?.id
        )
      )
      .map(
        (producto) =>
          ({
            id: producto.id,
            nombre: `${producto.nombre} (receta)`,
            unidad_base: producto.unidad_base || 'KG',
            costo_unitario: producto.costo_unitario || 0,
            iva_porcentaje: 0,
            impuesto_adicional_porcentaje: 0,
            activo: true,
            tipo_producto: 'receta',
            receta_id:
              recetas.find((receta) => receta.producto_id === producto.id)
                ?.id || null,
          }) as Recurso
      );
  }, [productos, recetaEditando?.id, recetas]);

  const recursosCalculables = useMemo(
    () => [...recursos, ...recetasComoIngredientes],
    [recetasComoIngredientes, recursos]
  );

  const ingredientesBase = useMemo(() => {
    return [
      ...recursos.filter((recurso) => recurso.tipo_producto === 'ingrediente'),
      ...recetasComoIngredientes,
    ].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [recetasComoIngredientes, recursos]);

  const insumosDisponibles = useMemo(() => {
    return recursos.filter((recurso) =>
      ['envase', 'mano_obra'].includes(
        String(recurso.tipo_producto)
      )
    );
  }, [recursos]);

  function calcularDetalle(lista: RecetaItemForm[]) {
    return lista.map((item) => {
      const recurso = recursosCalculables.find(
        (recursoItem) => String(recursoItem.id) === String(item.ingrediente_id)
      );

      const cantidad = numero(item.cantidad);
      const costoNeto = numero(recurso?.costo_unitario);
      const costoReceta = cantidad * costoNeto;

      return {
        ...item,
        recurso,
        cantidad,
        costoUnitario: costoNeto,
        costoReceta,
      } as DetalleCalculado;
    });
  }

  const detalleIngredientes = useMemo(() => {
    return calcularDetalle(items);
  }, [items, recursosCalculables]);

  const detalleInsumosDirectos = useMemo(() => {
    return calcularDetalle(insumos);
  }, [insumos, recursosCalculables]);

  const costoIngredientes = useMemo(() => {
    return detalleIngredientes.reduce(
      (total, item) => total + item.costoReceta,
      0
    );
  }, [detalleIngredientes]);

  const costoInsumosDirectos = useMemo(() => {
    return detalleInsumosDirectos.reduce(
      (total, item) => total + item.costoReceta,
      0
    );
  }, [detalleInsumosDirectos]);

  const subtotalDirecto = costoIngredientes + costoInsumosDirectos;

  const porcentajeIndirectos = numero(costosIndirectosPorcentaje);

  const costoIndirectos =
    subtotalDirecto > 0 ? subtotalDirecto * (porcentajeIndirectos / 100) : 0;

  const detalleInsumos = detalleInsumosDirectos;

  const costoTotalFinal = subtotalDirecto + costoIndirectos;

  const totalCantidadReceta = useMemo(() => {
    return detalleIngredientes.reduce((total, item) => total + item.cantidad, 0);
  }, [detalleIngredientes]);

  const totalBaseIngredientes = useMemo(() => {
    return detalleIngredientes.reduce((total, item) => total + item.cantidad, 0);
  }, [detalleIngredientes]);

  const costoPorKgFormula =
    totalBaseIngredientes > 0 ? costoIngredientes / totalBaseIngredientes : 0;

  const unidades = numero(unidadesProducidas);
  const pesoUnidad = numero(pesoUnidadKg);
  const pesoTotalProducido = unidades * pesoUnidad;

  const costoFinalPorKg =
    pesoTotalProducido > 0 ? costoTotalFinal / pesoTotalProducido : 0;

  const costoFinalPorUnidad = unidades > 0 ? costoTotalFinal / unidades : 0;
  const costoIngredientesPorUnidad = unidades > 0 ? costoIngredientes / unidades : 0;

  const productoSeleccionado = productos.find(
    (producto) => String(producto.id) === productoId
  );
  const recetaProduceIngrediente =
    productoSeleccionado?.tipo_producto === 'ingrediente';

  const familiaRelacion = productoSeleccionado?.familias_productos;
  const familiaSeleccionada = Array.isArray(familiaRelacion)
    ? familiaRelacion[0]
    : familiaRelacion;

  const usaConfiguracionFamilia =
    productoSeleccionado?.usar_configuracion_familia ?? true;

  const margenAplicado = usaConfiguracionFamilia
    ? numero(familiaSeleccionada?.margen_porcentaje)
    : numero(productoSeleccionado?.margen_personalizado);

  const tipoMargenAplicado = usaConfiguracionFamilia
    ? familiaSeleccionada?.tipo_margen || 'markup'
    : productoSeleccionado?.tipo_margen_personalizado || 'markup';

  const redondeoAplicado = usaConfiguracionFamilia
    ? numero(familiaSeleccionada?.redondeo_precio)
    : numero(productoSeleccionado?.redondeo_personalizado);
  const ivaVenta = ivaEmpresa;

  useEffect(() => {
    setTipoMargenCalculo(tipoMargenAplicado);
    setMargenCalculo(
      String(Math.round((margenAplicado || 0) * 100) / 100)
    );
    setPrecioVentaIngresado('');
    setModoPrecio('desde_margen');
  }, [productoId, tipoMargenAplicado, margenAplicado]);

  const margenObjetivo = numero(margenCalculo);
  const margenSobreVentaValido =
    tipoMargenCalculo !== 'margen_comercial' || margenObjetivo < 100;

  const precioCalculadoNeto =
    tipoMargenCalculo === 'margen_comercial' && margenSobreVentaValido
      ? costoFinalPorUnidad / (1 - margenObjetivo / 100)
      : tipoMargenCalculo === 'markup'
        ? costoFinalPorUnidad * (1 + margenObjetivo / 100)
        : 0;
  let precioCalculado = precioCalculadoNeto * (1 + ivaVenta / 100);

  if (redondeoAplicado > 0 && precioCalculado > 0) {
    precioCalculado =
      Math.ceil(precioCalculado / redondeoAplicado) * redondeoAplicado;
  }

  const precioVentaAnalizado =
    modoPrecio === 'desde_precio'
      ? numero(precioVentaIngresado)
      : precioCalculado;

  const precioVentaNeto =
    precioVentaAnalizado > 0
      ? precioVentaAnalizado / (1 + ivaVenta / 100)
      : 0;
  const gananciaPesos = precioVentaNeto - costoFinalPorUnidad;
  const porcentajeCalculado =
    precioVentaNeto > 0 && costoFinalPorUnidad > 0
      ? tipoMargenCalculo === 'markup'
        ? (gananciaPesos / costoFinalPorUnidad) * 100
        : (gananciaPesos / precioVentaNeto) * 100
      : 0;

  function calcularPrecioVenta(
    costoBase: number,
    porcentaje: number,
    tipo: TipoMargen = tipoMargenCalculo
  ) {
    const precioNeto =
      tipo === 'margen_comercial' && porcentaje < 100
        ? costoBase / (1 - porcentaje / 100)
        : tipo === 'markup'
          ? costoBase * (1 + porcentaje / 100)
          : 0;
    let precio = precioNeto * (1 + ivaVenta / 100);

    if (redondeoAplicado > 0) {
      precio = Math.ceil(precio / redondeoAplicado) * redondeoAplicado;
    }

    return precio;
  }

  async function guardarConfiguracionComercial() {
    if (!productoSeleccionado || precioVentaAnalizado <= 0) {
      alert('Selecciona un producto e ingresa un precio de venta válido.');
      return;
    }

    setGuardandoPrecio(true);

    const { error } = await supabase
      .from('productos')
      .update({
        precio: Math.round(precioVentaAnalizado),
        usar_configuracion_familia: false,
        margen_personalizado: Number(porcentajeCalculado.toFixed(2)),
        tipo_margen_personalizado: tipoMargenCalculo,
        redondeo_personalizado: redondeoAplicado,
      })
      .eq('id', productoSeleccionado.id);

    setGuardandoPrecio(false);

    if (error) {
      alert(error.message);
      return;
    }

    setProductos((actuales) =>
      actuales.map((producto) =>
        producto.id === productoSeleccionado.id
          ? {
              ...producto,
              usar_configuracion_familia: false,
              margen_personalizado: Number(porcentajeCalculado.toFixed(2)),
              tipo_margen_personalizado: tipoMargenCalculo,
            }
          : producto
      )
    );

    alert('Precio de venta y margen guardados en el producto.');
  }

  async function cargarRecetas() {
    const empresa = await obtenerEmpresaActual();

    if (!empresa) return;

    const { data, error } = await supabase
      .from('recetas')
      .select(`
        id,
        nombre,
        producto_id,
        rendimiento_kg,
        unidades_producidas,
        costos_indirectos_porcentaje,
        activo,
        productos (
          nombre
        )
      `)
      .eq('empresa_id', empresa.id)
      .order('nombre', { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setRecetas((data as unknown as RecetaGuardada[]) || []);
  }

  async function cargarDatos() {
    setLoading(true);

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      setLoading(false);
      return;
    }

    setIvaEmpresa(numero(empresa.iva_porcentaje ?? 19) || 19);

    const [
      { data: productosData, error: errorProductos },
      { data: recursosData, error: errorRecursos },
    ] = await Promise.all([
      supabase
        .from('productos')
        .select(`
          id,
          nombre,
          categoria,
          tipo_producto,
          unidad_base,
          costo_unitario,
          familia_id,
          usar_configuracion_familia,
          margen_personalizado,
          tipo_margen_personalizado,
          redondeo_personalizado,
          iva_porcentaje,
          familias_productos (
            nombre,
            margen_porcentaje,
            tipo_margen,
            redondeo_precio
          )
        `)
        .eq('empresa_id', empresa.id)
        .in('tipo_producto', ['producto', 'ingrediente'])
        .eq('activo', true)
        .order('nombre', { ascending: true }),
      supabase
        .from('productos')
        .select(`
          id,
          nombre,
          unidad_base,
          costo_unitario,
          iva_porcentaje,
          impuesto_adicional_porcentaje,
          activo,
          tipo_producto
        `)
        .eq('empresa_id', empresa.id)
        .in('tipo_producto', [
          'ingrediente',
          'envase',
          'mano_obra',
        ])
        .eq('activo', true)
        .order('nombre', { ascending: true }),
    ]);

    if (errorProductos || errorRecursos) {
      alert(errorProductos?.message || errorRecursos?.message);
      setLoading(false);
      return;
    }

    setProductos((productosData as unknown as Producto[]) || []);
    setRecursos((recursosData as Recurso[]) || []);
    await cargarRecetas();
    setLoading(false);
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (loading || borradorListo) return;

    try {
      const almacenado = window.localStorage.getItem(CLAVE_BORRADOR_RECETA);
      if (almacenado) {
        const borrador = JSON.parse(almacenado);

        setProductoId(String(borrador.productoId || ''));
        setNombre(String(borrador.nombre || ''));
        setPesoUnidadKg(String(borrador.pesoUnidadKg || '1'));
        setUnidadesProducidas(String(borrador.unidadesProducidas || '1'));
        setCostosIndirectosPorcentaje(
          String(borrador.costosIndirectosPorcentaje || '0')
        );
        setItems(Array.isArray(borrador.items) ? borrador.items : []);
        setInsumos(Array.isArray(borrador.insumos) ? borrador.insumos : []);
        setSubproductos(
          Array.isArray(borrador.subproductos) ? borrador.subproductos : []
        );
        setTabActiva(
          ['ingredientes', 'insumos', 'resumen', 'subproductos'].includes(
            borrador.tabActiva
          )
            ? borrador.tabActiva
            : 'ingredientes'
        );

        const tieneContenido =
          borrador.productoId ||
          borrador.nombre ||
          borrador.items?.length ||
          borrador.insumos?.length ||
          borrador.subproductos?.length;
        setBorradorRecuperado(Boolean(tieneContenido));
      }
    } catch {
      window.localStorage.removeItem(CLAVE_BORRADOR_RECETA);
    }

    setBorradorListo(true);
  }, [loading, borradorListo]);

  useEffect(() => {
    if (!borradorListo) return;

    const tieneContenido =
      productoId ||
      nombre.trim() ||
      items.length > 0 ||
      insumos.length > 0 ||
      subproductos.length > 0;

    if (!tieneContenido) {
      window.localStorage.removeItem(CLAVE_BORRADOR_RECETA);
      return;
    }

    window.localStorage.setItem(
      CLAVE_BORRADOR_RECETA,
      JSON.stringify({
        productoId,
        nombre,
        pesoUnidadKg,
        unidadesProducidas,
        costosIndirectosPorcentaje,
        items,
        insumos,
        subproductos,
        tabActiva,
        guardadoEn: new Date().toISOString(),
      })
    );
  }, [
    borradorListo,
    productoId,
    nombre,
    pesoUnidadKg,
    unidadesProducidas,
    costosIndirectosPorcentaje,
    items,
    insumos,
    subproductos,
    tabActiva,
  ]);

  function agregarIngrediente() {
    setItems([...items, { ingrediente_id: '', cantidad: '' }]);
  }

  function agregarInsumo() {
    setInsumos([...insumos, { ingrediente_id: '', cantidad: '' }]);
  }

  function agregarSubproducto() {
    setSubproductos([
      ...subproductos,
      {
        producto_id: '',
        nombre: '',
        peso_kg: '',
        margen_porcentaje: String(margenAplicado || 70),
      },
    ]);
  }

  function eliminarIngrediente(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function eliminarInsumo(index: number) {
    setInsumos(insumos.filter((_, i) => i !== index));
  }

  function eliminarSubproducto(index: number) {
    setSubproductos(subproductos.filter((_, i) => i !== index));
  }

  function actualizarItem(
    index: number,
    campo: keyof RecetaItemForm,
    valor: string
  ) {
    setItems(
      items.map((item, i) => (i === index ? { ...item, [campo]: valor } : item))
    );
  }

  function actualizarInsumo(
    index: number,
    campo: keyof RecetaItemForm,
    valor: string
  ) {
    setInsumos(
      insumos.map((item, i) =>
        i === index ? { ...item, [campo]: valor } : item
      )
    );
  }

  function actualizarSubproducto(
    index: number,
    campo: keyof SubproductoForm,
    valor: string
  ) {
    setSubproductos(
      subproductos.map((item, i) => {
        if (i !== index) return item;

        if (campo === 'producto_id') {
          const producto = productos.find(
            (productoItem) => String(productoItem.id) === String(valor)
          );

          return {
            ...item,
            producto_id: valor,
            nombre: item.nombre || producto?.nombre || '',
          };
        }

        return { ...item, [campo]: valor };
      })
    );
  }

  function limpiarFormulario() {
    window.localStorage.removeItem(CLAVE_BORRADOR_RECETA);
    setBorradorRecuperado(false);
    setProductoId('');
    setNombre('');
    setPesoUnidadKg('1');
    setUnidadesProducidas('1');
    setCostosIndirectosPorcentaje('0');
    setItems([]);
    setInsumos([]);
    setSubproductos([]);
    setRecetaEditando(null);
  }

  async function editarReceta(receta: RecetaGuardada) {
    setRecetaEditando(receta);

    setProductoId(String(receta.producto_id));
    setNombre(receta.nombre);
    setPesoUnidadKg(String(receta.rendimiento_kg));
    setUnidadesProducidas(String(receta.unidades_producidas));
    setCostosIndirectosPorcentaje(String(receta.costos_indirectos_porcentaje ?? 0));

    const { data, error } = await supabase
      .from('receta_ingredientes')
      .select('ingrediente_id, cantidad')
      .eq('receta_id', receta.id);

    if (error) {
      alert(error.message);
      return;
    }

    const detalle = (data || []).map((item) => ({
      ingrediente_id: String(item.ingrediente_id),
      cantidad: String(item.cantidad),
    }));

    setItems(
      detalle.filter((item) => {
        const recurso = recursosCalculables.find(
          (recursoItem) => String(recursoItem.id) === item.ingrediente_id
        );
        return recurso?.tipo_producto === 'ingrediente' || recurso?.tipo_producto === 'receta';
      })
    );

    setInsumos(
      detalle.filter((item) => {
        const recurso = recursosCalculables.find(
          (recursoItem) => String(recursoItem.id) === item.ingrediente_id
        );
        return recurso?.tipo_producto === 'envase' || recurso?.tipo_producto === 'mano_obra';
      })
    );

    const { data: subproductosData, error: errorSubproductos } = await supabase
      .from('receta_subproductos')
      .select('producto_id,nombre,peso_kg,margen_porcentaje')
      .eq('receta_id', receta.id)
      .eq('activo', true)
      .order('created_at', { ascending: true });

    if (errorSubproductos) {
      alert(errorSubproductos.message);
      return;
    }

    setSubproductos(
      (subproductosData || []).map((item) => ({
        producto_id: item.producto_id ? String(item.producto_id) : '',
        nombre: item.nombre || '',
        peso_kg: String(item.peso_kg || ''),
        margen_porcentaje: String(item.margen_porcentaje ?? margenAplicado ?? 0),
      }))
    );

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function guardarReceta() {
    if (!productoId) {
      alert('Selecciona un producto.');
      return;
    }

    if (!nombre) {
      alert('Ingresa un nombre para la receta.');
      return;
    }

    if (numero(pesoUnidadKg) <= 0) {
      alert('Ingresa el peso por unidad en kg.');
      return;
    }

    if (numero(unidadesProducidas) <= 0) {
      alert('Ingresa cuántas unidades produce la receta.');
      return;
    }

    const itemsValidos = items.filter(
      (item) => item.ingrediente_id && numero(item.cantidad) > 0
    );

    const insumosValidos = insumos.filter(
      (item) => item.ingrediente_id && numero(item.cantidad) > 0
    );

    if (itemsValidos.length === 0) {
      alert('Agrega ingredientes válidos.');
      return;
    }

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      return;
    }

    setGuardando(true);

    const detalle = [...itemsValidos, ...insumosValidos].map((item) => ({
      ingrediente_id: Number(item.ingrediente_id),
      cantidad: numero(item.cantidad),
    }));

    const subproductosValidos = subproductos.filter(
      (item) => numero(item.peso_kg) > 0 && (item.producto_id || item.nombre)
    );

    if (recetaEditando) {
      const { error: errorUpdate } = await supabase
        .from('recetas')
        .update({
          producto_id: Number(productoId),
          nombre,
          rendimiento_kg: numero(pesoUnidadKg) || 1,
          unidades_producidas: numero(unidadesProducidas) || 1,
          costos_indirectos_porcentaje: numero(costosIndirectosPorcentaje),
        })
        .eq('id', recetaEditando.id);

      if (errorUpdate) {
        alert(errorUpdate.message);
        setGuardando(false);
        return;
      }

      const { error: errorDelete } = await supabase
        .from('receta_ingredientes')
        .delete()
        .eq('receta_id', recetaEditando.id);

      if (errorDelete) {
        alert(errorDelete.message);
        setGuardando(false);
        return;
      }

      const { error: errorInsert } = await supabase
        .from('receta_ingredientes')
        .insert(
          detalle.map((item) => ({
            receta_id: recetaEditando.id,
            ingrediente_id: item.ingrediente_id,
            cantidad: item.cantidad,
          }))
        );

      if (errorInsert) {
        alert(errorInsert.message);
        setGuardando(false);
        return;
      }

      const { error: errorDeleteSubproductos } = await supabase
        .from('receta_subproductos')
        .delete()
        .eq('receta_id', recetaEditando.id);

      if (errorDeleteSubproductos) {
        alert(errorDeleteSubproductos.message);
        setGuardando(false);
        return;
      }

      if (subproductosValidos.length > 0) {
        const { error: errorInsertSubproductos } = await supabase
          .from('receta_subproductos')
          .insert(
            subproductosValidos.map((item) => {
              const producto = productos.find(
                (productoItem) => String(productoItem.id) === String(item.producto_id)
              );

              return {
                receta_id: recetaEditando.id,
                producto_id: item.producto_id ? Number(item.producto_id) : null,
                nombre: item.nombre || producto?.nombre || 'Subproducto',
                peso_kg: numero(item.peso_kg),
                margen_porcentaje: numero(item.margen_porcentaje),
                activo: true,
              };
            })
          );

        if (errorInsertSubproductos) {
          alert(errorInsertSubproductos.message);
          setGuardando(false);
          return;
        }
      }

      await supabase
        .from('productos')
        .update({ costo_unitario: costoFinalPorKg })
        .eq('id', Number(productoId));

      await cargarRecetas();
      limpiarFormulario();
      setGuardando(false);
      alert('Receta actualizada correctamente.');
      return;
    }

    const { data: receta, error: errorReceta } = await supabase
      .from('recetas')
      .insert({
        empresa_id: empresa.id,
        producto_id: Number(productoId),
        nombre,
        rendimiento_kg: numero(pesoUnidadKg) || 1,
        unidades_producidas: numero(unidadesProducidas) || 1,
        costos_indirectos_porcentaje: numero(costosIndirectosPorcentaje),
        activo: true,
      })
      .select('id')
      .single();

    if (errorReceta) {
      alert(errorReceta.message);
      setGuardando(false);
      return;
    }

    const { error: errorDetalle } = await supabase
      .from('receta_ingredientes')
      .insert(
        detalle.map((item) => ({
          receta_id: receta.id,
          ingrediente_id: item.ingrediente_id,
          cantidad: item.cantidad,
        }))
      );

    if (errorDetalle) {
      alert(errorDetalle.message);
      setGuardando(false);
      return;
    }

    if (subproductosValidos.length > 0) {
      const { error: errorSubproductos } = await supabase
        .from('receta_subproductos')
        .insert(
          subproductosValidos.map((item) => {
            const producto = productos.find(
              (productoItem) => String(productoItem.id) === String(item.producto_id)
            );

            return {
              receta_id: receta.id,
              producto_id: item.producto_id ? Number(item.producto_id) : null,
              nombre: item.nombre || producto?.nombre || 'Subproducto',
              peso_kg: numero(item.peso_kg),
              margen_porcentaje: numero(item.margen_porcentaje),
              activo: true,
            };
          })
        );

      if (errorSubproductos) {
        alert(errorSubproductos.message);
        setGuardando(false);
        return;
      }
    }

    await supabase
      .from('productos')
      .update({ costo_unitario: costoFinalPorKg })
      .eq('id', Number(productoId));

    limpiarFormulario();
    await cargarRecetas();
    setGuardando(false);
    alert('Receta guardada correctamente.');
  }

  return (
    <main className="min-h-screen bg-maruxa-crema px-5 py-12">
      <div className="mx-auto max-w-7xl">
        

        <p className="font-black uppercase tracking-[.24em] text-maruxa-rojo">
          Producción
        </p>

        <h1 className="mt-3 text-5xl font-black text-maruxa-chocolate">
          Recetas
        </h1>

        <div className="mt-8 flex flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-sm">
  {[
    { id: 'ingredientes', label: '🥣 Ingredientes' },
    { id: 'insumos', label: '📦 Insumos' },
    { id: 'resumen', label: '📊 Resumen' },
    { id: 'subproductos', label: '🎂 Subproductos' },
  ].map((tab) => (
    <button
      key={tab.id}
      type="button"
      onClick={() => setTabActiva(tab.id as typeof tabActiva)}
      className={`rounded-xl border px-5 py-3 text-sm font-black transition ${
        tabActiva === tab.id
          ? 'border-maruxa-rojo bg-red-50 text-maruxa-rojo shadow-sm'
          : 'border-transparent bg-maruxa-crema text-maruxa-chocolate hover:border-red-200 hover:bg-red-50 hover:text-maruxa-rojo'
      }`}
    >
      {tab.label}
    </button>
  ))}
</div>

        <section className="mt-10 rounded-[34px] bg-white p-6 shadow-premium">
          <h2 className="text-2xl font-black text-maruxa-chocolate">
            {recetaEditando ? 'Editar receta' : 'Nueva receta'}
          </h2>

          {recetaEditando && (
            <div className="mt-3 rounded-2xl bg-blue-50 p-3">
              <p className="font-black text-blue-800">
                Editando: {recetaEditando.nombre}
              </p>
            </div>
          )}

          {borradorRecuperado && !recetaEditando && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-black text-amber-800">
                Borrador recuperado automáticamente.
              </p>
              <button
                type="button"
                onClick={() => setBorradorRecuperado(false)}
                className="text-xs font-black text-amber-800"
              >
                Ocultar
              </button>
            </div>
          )}

          {loading ? (
            <p className="mt-6 font-black">Cargando datos...</p>
          ) : (
            <>
              <div className="mt-6 grid gap-5 md:grid-cols-3">
                <div className="rounded-2xl border bg-white p-4">
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-500">
                    Producto o ingrediente producido
                  </label>

                  <select
                    value={productoId}
                    onChange={(e) => setProductoId(e.target.value)}
                    className="w-full bg-transparent text-lg font-black outline-none"
                  >
                    <option value="">Seleccionar producto o ingrediente</option>
                    {productos.map((producto) => (
                      <option key={producto.id} value={producto.id}>
                        {producto.nombre}
                        {producto.tipo_producto === 'ingrediente'
                          ? ' · ingrediente'
                          : ' · producto'}
                      </option>
                    ))}
                  </select>

                  {familiaSeleccionada && (
                    <div className="mt-3 rounded-2xl bg-purple-50 p-3">
                      <p className="font-black text-purple-800">
                        📂 {familiaSeleccionada.nombre}
                      </p>
                      <p className="text-sm font-bold text-purple-700">
                        {tipoMargenAplicado === 'markup'
                          ? 'Markup sobre costo'
                          : 'Margen comercial sobre venta'}
                        {' · '}
                        {margenAplicado}% de margen
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-500">
                    Nombre interno de la receta
                  </label>

                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Cheesecake Piña Base"
                    className="w-full bg-transparent text-lg font-black outline-none"
                  />
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-500">
                    Unidades producidas
                  </label>

                  <input
                    type="number"
                    value={unidadesProducidas}
                    onChange={(e) => setUnidadesProducidas(e.target.value)}
                    className="w-full bg-transparent text-lg font-black outline-none"
                  />
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-500">
                    Peso por unidad (kg)
                  </label>

                  <input
                    type="number"
                    value={pesoUnidadKg}
                    onChange={(e) => setPesoUnidadKg(e.target.value)}
                    className="w-full bg-transparent text-lg font-black outline-none"
                  />
                </div>

                <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-4">
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-green-700">
                    Peso total producido
                  </label>

                  <div className="text-2xl font-black text-green-800">
                    {pesoTotalProducido.toLocaleString('es-CL', {
                      maximumFractionDigits: 3,
                    })}{' '}
                    kg
                  </div>

                  <p className="mt-1 text-xs font-bold text-green-700">
                    Unidades × peso por unidad
                  </p>
                </div>
              </div>

              {tabActiva === 'ingredientes' && (
                <>
              <div className="mt-8 rounded-[28px] bg-maruxa-crema p-5">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-xl font-black text-maruxa-chocolate">
                    Ingredientes base de la receta
                  </h3>

                  <button
                    type="button"
                    onClick={agregarIngrediente}
                    className="rounded-full border-2 border-red-700 bg-red-700 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:bg-red-800"
                  >
                    + Agregar ingrediente
                  </button>
                </div>

                <div className="mt-3 grid gap-1">
                  {items.map((item, index) => {
                    const ingredienteSeleccionado = ingredientesBase.find(
                      (ingrediente) =>
                        String(ingrediente.id) === String(item.ingrediente_id)
                    );

                    return (
                      <div
                        key={index}
                        className="grid gap-1 rounded-xl bg-white p-2 md:grid-cols-[1fr_120px_40px_auto]"
                      >
                        <select
                          value={item.ingrediente_id}
                          onChange={(e) =>
                            actualizarItem(index, 'ingrediente_id', e.target.value)
                          }
                          className="rounded-2xl border px-4 py-3 font-bold"
                        >
                          <option value="">Ingrediente</option>
                          {ingredientesBase.map((ingrediente) => (
                            <option key={ingrediente.id} value={ingrediente.id}>
                              {ingrediente.nombre}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          value={item.cantidad}
                          onChange={(e) =>
                            actualizarItem(index, 'cantidad', e.target.value)
                          }
                          placeholder={
                            ingredienteSeleccionado?.unidad_base
                              ? `Cantidad en ${ingredienteSeleccionado.unidad_base}`
                              : 'Cantidad'
                          }
                          className="rounded-2xl border px-4 py-3 font-bold"
                        />

                        <div className="rounded-2xl bg-gray-100 px-4 py-3 text-center font-black">
                          {ingredienteSeleccionado?.unidad_base?.toUpperCase() || '-'}
                        </div>

                        <button
                          type="button"
                          onClick={() => eliminarIngrediente(index)}
                          className="rounded-full border border-red-300 bg-red-50 px-5 py-3 font-black text-red-700 transition hover:bg-red-600 hover:text-white"
                        >
                          Eliminar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <section className="mt-8 grid gap-6 lg:grid-cols-2">
                <div className="rounded-[28px] border border-maruxa-crema bg-maruxa-crema p-5 shadow-sm">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h3 className="text-xl font-black text-maruxa-chocolate">
                        Receta base
                      </h3>
                      <p className="mt-1 text-sm font-bold text-maruxa-cafe/70">
                        Esta receta produce {unidades.toLocaleString('es-CL')}{' '}
                        unidades de {pesoUnidad.toLocaleString('es-CL')} kg
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-maruxa-chocolate">
                      Peso total: {pesoTotalProducido.toLocaleString('es-CL', {
                        maximumFractionDigits: 3,
                      })}{' '}
                      kg
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto rounded-2xl border border-maruxa-crema bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-red-700 text-white">
                        <tr>
                          <th className="px-4 py-3 text-left">Ingrediente</th>
                          <th className="px-4 py-3 text-right">Cantidad</th>
                          <th className="px-4 py-3 text-center">Unidad</th>
                          <th className="px-4 py-3 text-right">IVA referencial</th>
                          <th className="px-4 py-3 text-right">Costo neto aplicado</th>
                          <th className="px-4 py-3 text-right">Costo</th>
                        </tr>
                      </thead>

                      <tbody>
                        {detalleIngredientes.map((item, index) => (
                          <tr
                            key={index}
                            className="border-b last:border-none hover:bg-maruxa-crema/40"
                          >
                            <td className="px-4 py-3 font-bold">
                              {item.recurso?.nombre || '-'}
                            </td>

                            <td className="px-4 py-3 text-right">
                            {numero(item.cantidad).toLocaleString('es-CL', {
                                maximumFractionDigits: 4,
                                })}
                            </td>

                            <td className="px-4 py-3 text-center">
                              {item.recurso?.unidad_base || '-'}
                            </td>

                            <td className="px-4 py-3 text-right">
                              {(
                                numero(item.recurso?.iva_porcentaje) +
                                numero(item.recurso?.impuesto_adicional_porcentaje)
                              ).toLocaleString('es-CL')}
                              %
                            </td>

                            <td className="px-4 py-3 text-right">
                              {dinero(item.costoUnitario)}
                            </td>

                            <td className="px-4 py-3 text-right font-black text-maruxa-vino">
                              {dinero(item.costoReceta)}
                            </td>
                          </tr>
                        ))}

                        <tr className="bg-maruxa-crema font-black text-maruxa-chocolate">
                          <td className="px-4 py-4">TOTAL INGREDIENTES</td>
                          <td className="px-4 py-4 text-right">
                            {totalCantidadReceta.toLocaleString('es-CL', {
                              maximumFractionDigits: 4,
                            })}
                          </td>
                          <td className="px-4 py-4 text-center">base</td>
                          <td className="px-4 py-4 text-right">—</td>
                          <td className="px-4 py-4 text-right">—</td>
                          <td className="px-4 py-4 text-right">
                            {dinero(costoIngredientes)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-[28px] border border-maruxa-crema bg-maruxa-crema p-5 shadow-sm">
                  <h3 className="text-xl font-black text-maruxa-chocolate">
                    Fórmula normalizada
                  </h3>

                  <p className="mt-1 text-sm font-bold text-maruxa-cafe/70">
                    Proporción matemática de ingredientes base a 1,0000.
                  </p>

                  <div className="mt-5 overflow-x-auto rounded-2xl border border-maruxa-crema bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-red-700 text-white">
                        <tr>
                          <th className="px-4 py-3 text-left">Ingrediente</th>
                          <th className="px-4 py-3 text-right">Cantidad normalizada</th>
                          <th className="px-4 py-3 text-center">Unidad</th>
                          <th className="px-4 py-3 text-right">Costo proporcional</th>
                        </tr>
                      </thead>

                      <tbody>
                        {detalleIngredientes.map((item, index) => {
                          const cantidadNormalizada =
                            totalBaseIngredientes > 0
                              ? item.cantidad / totalBaseIngredientes
                              : 0;

                          const costoNormalizado =
                            totalBaseIngredientes > 0
                              ? item.costoReceta / totalBaseIngredientes
                              : 0;

                          return (
                            <tr key={index} className="border-b last:border-none">
                              <td className="px-4 py-3 font-bold">
                                {item.recurso?.nombre || '-'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {cantidadNormalizada.toLocaleString('es-CL', {
                                  minimumFractionDigits: 4,
                                  maximumFractionDigits: 4,
                                })}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {item.recurso?.unidad_base || '-'}
                              </td>
                              <td className="px-4 py-3 text-right font-black text-maruxa-vino">
                                {dinero(costoNormalizado)}
                              </td>
                            </tr>
                          );
                        })}

                        <tr className="bg-maruxa-crema font-black">
                          <td className="px-4 py-4">TOTAL FÓRMULA</td>
                          <td className="px-4 py-4 text-right">1,0000</td>
                          <td className="px-4 py-4 text-center">base</td>
                          <td className="px-4 py-4 text-right">
                            {dinero(costoPorKgFormula)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
                </>
              )}


              {tabActiva === 'insumos' && (
                <>
              <section className="mt-8 rounded-[28px] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-black text-maruxa-chocolate">
                      Insumos adicionales
                    </h3>
                    <p className="mt-1 text-sm font-bold text-maruxa-cafe/70">
                      Envases y mano de obra. No afectan la fórmula base.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={agregarInsumo}
                    className="rounded-full border-2 border-red-700 bg-red-700 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:bg-red-800"
                  >
                    + Agregar insumo
                  </button>
                </div>

                <div className="mt-4 grid gap-1">
                  {insumos.map((item, index) => {
                    const insumoSeleccionado = insumosDisponibles.find(
                      (insumo) => String(insumo.id) === String(item.ingrediente_id)
                    );

                    return (
                      <div
                        key={index}
                        className="grid gap-1 rounded-xl bg-maruxa-crema p-2 md:grid-cols-[1fr_120px_70px_120px_auto]"
                      >
                        <select
                          value={item.ingrediente_id}
                          onChange={(e) =>
                            actualizarInsumo(index, 'ingrediente_id', e.target.value)
                          }
                          className="rounded-2xl border px-4 py-3 font-bold"
                        >
                          <option value="">Insumo</option>
                          {insumosDisponibles.map((insumo) => (
                            <option key={insumo.id} value={insumo.id}>
                              {insumo.nombre}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          value={item.cantidad}
                          onChange={(e) =>
                            actualizarInsumo(index, 'cantidad', e.target.value)
                          }
                          placeholder={
'Cantidad'
                          }
                          className="rounded-2xl border px-4 py-3 font-bold"
                        />

                        <div className="rounded-2xl bg-white px-4 py-3 text-center font-black">
                          {insumoSeleccionado?.unidad_base?.toUpperCase() || '-'}
                        </div>

                        <div className="rounded-2xl bg-white px-4 py-3 text-center text-xs font-black text-gray-700">
                          {nombreTipo(insumoSeleccionado?.tipo_producto)}
                        </div>

                        <button
                          type="button"
                          onClick={() => eliminarInsumo(index)}
                          className="rounded-full border border-red-300 bg-red-50 px-5 py-3 font-black text-red-700 transition hover:bg-red-600 hover:text-white"
                        >
                          Eliminar
                        </button>
                      </div>
                    );
                  })}
                </div>

                {detalleInsumos.length > 0 && (
                  <div className="mt-5 overflow-x-auto rounded-2xl border border-maruxa-crema bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-red-700 text-white">
                        <tr>
                          <th className="px-4 py-3 text-left">Insumo</th>
                          <th className="px-4 py-3 text-center">Tipo</th>
                          <th className="px-4 py-3 text-right">Cantidad</th>
                          <th className="px-4 py-3 text-center">Unidad</th>
                          <th className="px-4 py-3 text-right">Costo</th>
                        </tr>
                      </thead>

                      <tbody>
                        {detalleInsumos.map((item, index) => (
                          <tr key={index} className="border-b last:border-none">
                            <td className="px-4 py-3 font-bold">
                              {item.recurso?.nombre || '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {nombreTipo(item.recurso?.tipo_producto)}
                            </td>
                            <td className="px-4 py-3 text-right">
                            {numero(item.cantidad).toLocaleString('es-CL', {
                            maximumFractionDigits: 4,
                            })}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {item.recurso?.unidad_base || '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-black text-maruxa-vino">
                              {dinero(item.costoReceta)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="mt-8 rounded-[28px] bg-white p-5 shadow-sm">
                <h3 className="text-xl font-black text-maruxa-chocolate">
                  Costos indirectos
                </h3>
                <p className="mt-1 text-sm font-bold text-maruxa-cafe/70">
                  Porcentaje editable aplicado sobre ingredientes + envases + mano de obra.
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border bg-white p-4">
                    <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-500">
                      Indirectos (%)
                    </label>
                    <input
                      type="number"
                      value={costosIndirectosPorcentaje}
                      onChange={(e) => setCostosIndirectosPorcentaje(e.target.value)}
                      className="w-full bg-transparent text-lg font-black outline-none"
                    />
                  </div>

                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                    <p className="text-sm font-black uppercase text-orange-800">
                      Base indirectos
                    </p>
                    <p className="mt-2 text-3xl font-black text-orange-900">
                      {dinero(subtotalDirecto)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                    <p className="text-sm font-black uppercase text-orange-800">
                      Costo indirecto
                    </p>
                    <p className="mt-2 text-3xl font-black text-orange-900">
                      {dinero(costoIndirectos)}
                    </p>
                  </div>
                </div>
              </section>
                </>
              )}


              {tabActiva === 'resumen' && (
              <section className="mt-8 rounded-[28px] border border-maruxa-crema bg-maruxa-crema p-5 shadow-sm">
                <h3 className="text-2xl font-black text-maruxa-chocolate">
                  Resumen final de costos
                </h3>

                {!recetaProduceIngrediente && (
                <div className="mt-5 grid gap-4 rounded-2xl border border-[#4B2818]/15 bg-white p-4 lg:grid-cols-[auto_1fr_1fr]">
                  <div>
                    <p className="text-xs font-black uppercase text-[#4B2818]/60">
                      Calcular
                    </p>
                    <div className="mt-2 flex rounded-lg bg-maruxa-crema p-1">
                      <button
                        type="button"
                        onClick={() => setModoPrecio('desde_margen')}
                        className={`h-10 px-4 text-sm font-black ${
                          modoPrecio === 'desde_margen'
                            ? 'rounded-md bg-[#A51F2B] text-white'
                            : 'text-[#4B2818]'
                        }`}
                      >
                        Precio desde margen
                      </button>
                      <button
                        type="button"
                        onClick={() => setModoPrecio('desde_precio')}
                        className={`h-10 px-4 text-sm font-black ${
                          modoPrecio === 'desde_precio'
                            ? 'rounded-md bg-[#A51F2B] text-white'
                            : 'text-[#4B2818]'
                        }`}
                      >
                        Margen desde precio
                      </button>
                    </div>
                  </div>

                  <label className="grid gap-2 text-xs font-black uppercase text-[#4B2818]/60">
                    Tipo de margen
                    <select
                      value={tipoMargenCalculo}
                      onChange={(event) =>
                        setTipoMargenCalculo(event.target.value as TipoMargen)
                      }
                      className="h-11 rounded-md border border-[#4B2818]/20 bg-white px-3 text-base font-black normal-case text-[#2A1710]"
                    >
                      <option value="markup">Sobre costo (markup)</option>
                      <option value="margen_comercial">Sobre venta</option>
                    </select>
                  </label>

                  {modoPrecio === 'desde_margen' ? (
                    <label className="grid gap-2 text-xs font-black uppercase text-[#4B2818]/60">
                      Margen objetivo %
                      <input
                        type="number"
                        min="0"
                        max={tipoMargenCalculo === 'margen_comercial' ? 99.99 : undefined}
                        step="0.01"
                        value={margenCalculo}
                        onChange={(event) => setMargenCalculo(event.target.value)}
                        className="h-11 rounded-md border border-[#4B2818]/20 px-3 text-base font-black text-[#2A1710]"
                      />
                    </label>
                  ) : (
                    <label className="grid gap-2 text-xs font-black uppercase text-[#4B2818]/60">
                      Precio de venta
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={precioVentaIngresado}
                        onChange={(event) =>
                          setPrecioVentaIngresado(event.target.value)
                        }
                        className="h-11 rounded-md border border-[#4B2818]/20 px-3 text-base font-black text-[#2A1710]"
                      />
                    </label>
                  )}
                </div>
                )}

                {!recetaProduceIngrediente && !margenSobreVentaValido && (
                  <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-black text-red-700">
                    El margen sobre venta debe ser menor a 100%.
                  </p>
                )}

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-black uppercase text-amber-800">
                      Ingredientes base
                    </p>
                    <p className="mt-2 text-3xl font-black text-amber-900">
                      {dinero(costoIngredientes)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                    <p className="text-sm font-black uppercase text-sky-800">
                      Envases / mano de obra
                    </p>
                    <p className="mt-2 text-3xl font-black text-sky-900">
                      {dinero(costoInsumosDirectos)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                    <p className="text-sm font-black uppercase text-orange-800">
                      Costos indirectos
                    </p>
                    <p className="mt-2 text-3xl font-black text-orange-900">
                      {dinero(costoIndirectos)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-black uppercase text-blue-800">
                      Costo final por kg
                    </p>
                    <p className="mt-2 text-3xl font-black text-blue-900">
                      {dinero(costoFinalPorKg)}
                    </p>
                  </div>

                  {!recetaProduceIngrediente && (
                    <>
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-black uppercase text-green-800">
                      Costo final por unidad
                    </p>
                    <p className="mt-2 text-3xl font-black text-green-900">
                      {dinero(costoFinalPorUnidad)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-black uppercase text-green-800">
                      {modoPrecio === 'desde_precio'
                        ? 'Precio de venta ingresado'
                        : 'Precio sugerido final'}
                    </p>
                    {productoId ? (
                      <p className="mt-2 text-3xl font-black text-green-900">
                        {dinero(precioVentaAnalizado)}
                      </p>
                    ) : (
                        <p className="mt-2 text-3xl font-black text-green-900">
                        Selecciona un producto
                      </p>
                    )}
                  </div>
                    </>
                  )}
                </div>

                {recetaProduceIngrediente ? (
                  <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <p className="font-black text-blue-900">
                      Esta receta produce un ingrediente.
                    </p>
                    <p className="mt-1 text-sm font-bold text-blue-700">
                      Al guardar, el sistema actualizará su costo unitario con el costo final por kg calculado.
                    </p>
                  </div>
                ) : (
                <div className="mt-5 rounded-2xl border border-purple-200 bg-purple-50 p-4">
                  {!productoId ? (
                    <p className="font-bold text-purple-700">
                      Selecciona un producto para ver la configuración comercial.
                    </p>
                  ) : (
                    <p className="mt-2 text-xl font-black text-purple-900">
                      {familiaSeleccionada?.nombre || 'Sin familia'}
                    </p>
                  )}

                  <p className="mt-1 text-sm font-bold text-purple-700">
                    Método:{' '}
                    {tipoMargenCalculo === 'markup'
                      ? 'Utilidad sobre costo'
                      : 'Margen comercial sobre venta'}
                  </p>
                  <p className="mt-1 text-sm font-bold text-purple-700">
                    Margen efectivo:{' '}
                    {porcentajeCalculado.toLocaleString('es-CL', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    %
                  </p>
                  <p className="mt-1 text-sm font-bold text-purple-700">
                    Venta neta: {dinero(precioVentaNeto)} · IVA: {ivaVenta.toLocaleString('es-CL')}%
                  </p>
                  <p className="mt-1 text-sm font-bold text-purple-700">
                    Redondeo: {dinero(redondeoAplicado)}
                  </p>
                  <p className="mt-1 text-sm font-bold text-purple-700">
                    Ganancia: {dinero(gananciaPesos)} por unidad
                  </p>
                  <button
                    type="button"
                    onClick={guardarConfiguracionComercial}
                    disabled={
                      guardandoPrecio ||
                      !productoId ||
                      precioVentaAnalizado <= 0 ||
                      !margenSobreVentaValido
                    }
                    className="mt-4 h-10 rounded-md bg-[#A51F2B] px-4 text-sm font-black text-white disabled:opacity-50"
                  >
                    {guardandoPrecio
                      ? 'Guardando...'
                      : 'Guardar precio y margen en el producto'}
                  </button>
                </div>
                )}
              </section>
              )}


              {tabActiva === 'subproductos' && (
              <section className="mt-8 rounded-[28px] bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-maruxa-chocolate">
                      Costeo por tamaños / subproductos
                    </h3>
                    <p className="mt-1 text-sm font-bold text-maruxa-cafe/70">
                      Ingresa el peso de cada subproducto. El costo se calcula como peso × costo final por kg y el precio con la utilidad configurada.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={agregarSubproducto}
                    className="rounded-full border-2 border-red-700 bg-red-700 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:bg-red-800"
                  >
                    + Agregar tamaño
                  </button>
                </div>


                <div className="mt-4 overflow-x-auto rounded-2xl bg-white p-3">
                <div className="grid gap-2">
                  {subproductos.map((subproducto, index) => {
                    const costoBase = costoFinalPorKg * numero(subproducto.peso_kg);
                    const margen = numero(subproducto.margen_porcentaje);
                    const precioVenta = calcularPrecioVenta(costoBase, margen);

                    return (
                      <div
                        key={index}
                        className="grid min-w-[980px] gap-2 rounded-2xl bg-maruxa-crema p-3 md:grid-cols-[1.4fr_1fr_110px_110px_130px_130px_auto]"
                      >
                        <select
                          value={subproducto.producto_id}
                          onChange={(e) =>
                            actualizarSubproducto(index, 'producto_id', e.target.value)
                          }
                          className="rounded-2xl border px-4 py-3 font-bold"
                        >
                          <option value="">Producto vinculado</option>
                          {productos.map((producto) => (
                            <option key={producto.id} value={producto.id}>
                              {producto.nombre}
                            </option>
                          ))}
                        </select>

                        <input
                          value={subproducto.nombre}
                          onChange={(e) =>
                            actualizarSubproducto(index, 'nombre', e.target.value)
                          }
                          placeholder="Nombre / tamaño"
                          className="rounded-2xl border px-4 py-3 font-bold"
                        />

                        <input
                          type="number"
                          value={subproducto.peso_kg}
                          onChange={(e) =>
                            actualizarSubproducto(index, 'peso_kg', e.target.value)
                          }
                          placeholder="Peso kg"
                          className="rounded-2xl border px-4 py-3 text-right font-bold"
                        />

                        <input
                          type="number"
                          value={subproducto.margen_porcentaje}
                          onChange={(e) =>
                            actualizarSubproducto(
                              index,
                              'margen_porcentaje',
                              e.target.value
                            )
                          }
                          placeholder="Utilidad %"
                          className="rounded-2xl border px-4 py-3 text-right font-bold"
                        />

                        <div className="rounded-2xl bg-white px-4 py-3 text-right font-black text-maruxa-chocolate">
                          {dinero(costoBase)}
                        </div>

                        <div className="rounded-2xl bg-white px-4 py-3 text-right font-black text-maruxa-vino">
                          {dinero(precioVenta)}
                        </div>

                        <button
                          type="button"
                          onClick={() => eliminarSubproducto(index)}
                          className="rounded-full border border-red-300 bg-red-50 px-5 py-3 font-black text-red-700 transition hover:bg-red-600 hover:text-white"
                        >
                          Eliminar
                        </button>
                      </div>
                    );
                  })}
                </div>
                </div>

                {subproductos.length > 0 && (
                  <div className="mt-5 overflow-x-auto rounded-2xl border border-maruxa-crema bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-red-700 text-white">
                        <tr>
                          <th className="px-4 py-3 text-left">Subproducto</th>
                          <th className="px-4 py-3 text-right">Peso kg</th>
                          <th className="px-4 py-3 text-right">Costo por kg</th>
                          <th className="px-4 py-3 text-right">Costo calculado</th>
                          <th className="px-4 py-3 text-right">Margen</th>
                          <th className="px-4 py-3 text-right">Precio sugerido</th>
                        </tr>
                      </thead>

                      <tbody>
                        {subproductos.map((subproducto, index) => {
                          const producto = productos.find(
                            (productoItem) =>
                              String(productoItem.id) === String(subproducto.producto_id)
                          );
                          const pesoSubproducto = numero(subproducto.peso_kg);
                          const margen = numero(subproducto.margen_porcentaje);
                          const costoBase = costoFinalPorKg * pesoSubproducto;
                          const precioVenta = calcularPrecioVenta(costoBase, margen);

                          return (
                            <tr key={index} className="border-b last:border-none">
                              <td className="px-4 py-3 font-bold">
                                {subproducto.nombre || producto?.nombre || '-'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {pesoSubproducto.toLocaleString('es-CL', {
                                  maximumFractionDigits: 3,
                                })}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {dinero(costoFinalPorKg)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {dinero(costoBase)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {margen.toLocaleString('es-CL')}%
                              </td>
                              <td className="px-4 py-3 text-right font-black text-maruxa-vino">
                                {dinero(precioVenta)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              )}


              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={guardarReceta}
                  disabled={guardando}
                  className="rounded-full border-2 border-red-700 bg-red-700 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:bg-red-800"
                >
                  {guardando
                    ? 'Guardando...'
                    : recetaEditando
                      ? 'Actualizar receta'
                      : 'Guardar receta'}
                </button>

                {recetaEditando && (
                  <button
                    type="button"
                    onClick={limpiarFormulario}
                    className="rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-black"
                  >
                    Cancelar edición
                  </button>
                )}

                <button
                  type="button"
                  onClick={limpiarFormulario}
                  className="rounded-full border-2 border-red-700 bg-red-700 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:bg-red-800"
                >
                  Limpiar
                </button>
              </div>
            </>
          )}
        </section>

        <section className="mt-10 rounded-[34px] bg-white p-6 shadow-premium">
          <h2 className="text-2xl font-black text-maruxa-chocolate">
            Recetas registradas
          </h2>

          {recetas.length === 0 ? (
            <p className="mt-4 text-gray-500">No hay recetas registradas.</p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-maruxa-rojo text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Producto</th>
                    <th className="px-4 py-3 text-left">Receta</th>
                    <th className="px-4 py-3 text-right">Peso unidad</th>
                    <th className="px-4 py-3 text-right">Unidades</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-center">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {recetas.map((receta) => (
                    <tr
                      key={receta.id}
                      className="border-b hover:bg-maruxa-crema/40"
                    >
                      <td className="px-4 py-3 font-bold">
                        {Array.isArray(receta.productos)
                          ? receta.productos[0]?.nombre
                          : receta.productos?.nombre}
                      </td>

                      <td className="px-4 py-3">{receta.nombre}</td>

                      <td className="px-4 py-3 text-right">
                        {receta.rendimiento_kg} kg
                      </td>

                      <td className="px-4 py-3 text-right">
                        {receta.unidades_producidas}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {receta.activo ? '✅ Activa' : '⛔ Inactiva'}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => editarReceta(receta)}
                          className="rounded-full bg-blue-600 px-4 py-2 text-xs font-black text-white"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
