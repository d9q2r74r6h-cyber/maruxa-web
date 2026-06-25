'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAdminSession } from '@/components/AdminSession';

type Cliente = {
  id: string;
  rut: string;
  razon_social: string;
  giro: string | null;
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
};

type Producto = {
  id: number;
  codigo: string | null;
  nombre: string;
  precio: number;
  unidad_base: string | null;
  iva_porcentaje: number | null;
};

type Linea = {
  id: number;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  descuento_porcentaje: number;
  exento: boolean;
};

const nuevaLinea = (): Linea => ({
  id: Date.now() + Math.random(),
  producto_id: '',
  cantidad: 1,
  precio_unitario: 0,
  descuento_porcentaje: 0,
  exento: false,
});

export default function NuevoDocumentoPage() {
  const router = useRouter();
  const { perfil } = useAdminSession();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [tipoDte, setTipoDte] = useState(33);
  const [fechaEmision, setFechaEmision] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [formaPago, setFormaPago] = useState('contado');
  const [observaciones, setObservaciones] = useState('');
  const [referencia, setReferencia] = useState({
    tipo: '',
    folio: '',
    fecha: '',
    codigo: '',
    razon: '',
  });
  const [lineas, setLineas] = useState<Linea[]>([nuevaLinea()]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    async function cargar() {
      if (!perfil) return;
      const [respuestaClientes, respuestaProductos] = await Promise.all([
        supabase
          .from('clientes')
          .select('id, rut, razon_social, giro, direccion, comuna, ciudad')
          .eq('empresa_id', perfil.empresa_id)
          .eq('activo', true)
          .order('razon_social'),
        supabase
          .from('productos')
          .select('id, codigo, nombre, precio, unidad_base, iva_porcentaje')
          .eq('empresa_id', perfil.empresa_id)
          .eq('activo', true)
          .eq('tipo_producto', 'producto')
          .order('nombre'),
      ]);

      setClientes((respuestaClientes.data || []) as Cliente[]);
      setProductos((respuestaProductos.data || []) as Producto[]);
    }

    cargar();
  }, [perfil]);

  const cliente = clientes.find((item) => item.id === clienteId);
  const calculo = useMemo(() => {
    let neto = 0;
    let exento = 0;

    for (const linea of lineas) {
      const bruto = linea.cantidad * linea.precio_unitario;
      const descuento = bruto * (linea.descuento_porcentaje / 100);
      const totalLinea = Math.max(0, bruto - descuento);
      if (linea.exento || tipoDte === 34) exento += totalLinea;
      else neto += totalLinea;
    }

    const iva = Math.round(neto * 0.19);
    return {
      neto: Math.round(neto),
      exento: Math.round(exento),
      iva,
      total: Math.round(neto + exento + iva),
    };
  }, [lineas, tipoDte]);

  function cambiarProducto(lineaId: number, productoId: string) {
    const producto = productos.find(
      (item) => item.id === Number(productoId)
    );
    const tasaIva = Number(producto?.iva_porcentaje ?? 19);
    const esExento = tasaIva === 0;
    const precioVenta = Number(producto?.precio || 0);
    const precioNeto =
      esExento || tasaIva <= 0
        ? precioVenta
        : precioVenta / (1 + tasaIva / 100);

    setLineas((actuales) =>
      actuales.map((linea) =>
        linea.id === lineaId
          ? {
              ...linea,
              producto_id: productoId,
              precio_unitario: Number(precioNeto.toFixed(4)),
              exento: esExento,
            }
          : linea
      )
    );
  }

  async function guardarDocumento() {
    if (!perfil || !cliente) {
      alert('Selecciona un cliente.');
      return;
    }

    const lineasValidas = lineas.filter(
      (linea) =>
        linea.producto_id &&
        linea.cantidad > 0 &&
        linea.precio_unitario >= 0
    );

    if (lineasValidas.length === 0) {
      alert('Agrega al menos un producto.');
      return;
    }

    setGuardando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: documento, error } = await supabase
      .from('documentos_tributarios')
      .insert({
        empresa_id: perfil.empresa_id,
        cliente_id: cliente.id,
        tipo_dte: tipoDte,
        fecha_emision: fechaEmision,
        fecha_vencimiento: fechaVencimiento || null,
        forma_pago: formaPago,
        estado: 'borrador',
        rut_receptor: cliente.rut,
        razon_social_receptor: cliente.razon_social,
        giro_receptor: cliente.giro,
        direccion_receptor: cliente.direccion,
        comuna_receptor: cliente.comuna,
        ciudad_receptor: cliente.ciudad,
        monto_exento: calculo.exento,
        monto_neto: calculo.neto,
        tasa_iva: 19,
        monto_iva: calculo.iva,
        monto_total: calculo.total,
        observaciones: observaciones || null,
        creado_por: user?.id || null,
      })
      .select('id')
      .single();

    if (error || !documento) {
      alert(error?.message || 'No se pudo crear el documento.');
      setGuardando(false);
      return;
    }

    const detalles = lineasValidas.map((linea, indice) => {
      const producto = productos.find(
        (item) => item.id === Number(linea.producto_id)
      )!;
      const bruto = linea.cantidad * linea.precio_unitario;
      const descuento = bruto * (linea.descuento_porcentaje / 100);

      return {
        documento_id: documento.id,
        numero_linea: indice + 1,
        producto_id: producto.id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        cantidad: linea.cantidad,
        unidad: producto.unidad_base,
        precio_unitario: linea.precio_unitario,
        descuento_porcentaje: linea.descuento_porcentaje,
        descuento_monto: Math.round(descuento),
        exento: linea.exento || tipoDte === 34,
        monto_item: Math.round(bruto - descuento),
      };
    });

    const { error: errorDetalle } = await supabase
      .from('documento_tributario_detalles')
      .insert(detalles);

    if (errorDetalle) {
      await supabase
        .from('documentos_tributarios')
        .delete()
        .eq('id', documento.id);
      alert(errorDetalle.message);
      setGuardando(false);
      return;
    }

    if (referencia.tipo && referencia.folio) {
      const { error: errorReferencia } = await supabase
        .from('documento_tributario_referencias')
        .insert({
          documento_id: documento.id,
          numero_linea: 1,
          tipo_documento_referencia: referencia.tipo,
          folio_referencia: referencia.folio,
          fecha_referencia: referencia.fecha || null,
          codigo_referencia: referencia.codigo
            ? Number(referencia.codigo)
            : null,
          razon_referencia: referencia.razon || null,
        });

      if (errorReferencia) {
        await supabase
          .from('documentos_tributarios')
          .delete()
          .eq('id', documento.id);
        alert(errorReferencia.message);
        setGuardando(false);
        return;
      }
    }

    router.replace('/admin/documentos');
    router.refresh();
  }

  return (
    <div className="space-y-6 pb-12">
      <header>
        <p className="text-xs font-black uppercase tracking-wide text-[#A51F2B]">
          Nuevo documento
        </p>
        <h1 className="mt-2 text-3xl font-black text-[#2A1710]">
          Factura o guía de despacho
        </h1>
      </header>

      <section className="grid gap-4 rounded-lg border border-[#4B2818]/15 bg-white p-5 md:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1 text-xs font-black text-[#4B2818] xl:col-span-2">
          Tipo de documento
          <select
            value={tipoDte}
            onChange={(event) => setTipoDte(Number(event.target.value))}
            className="h-10 rounded-md border border-[#4B2818]/20 bg-white px-3 font-bold"
          >
            <option value={33}>Factura electrónica</option>
            <option value={34}>Factura exenta electrónica</option>
            <option value={52}>Guía de despacho electrónica</option>
            <option value={56}>Nota de débito electrónica</option>
            <option value={61}>Nota de crédito electrónica</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-[#4B2818] xl:col-span-2">
          Cliente
          <select
            value={clienteId}
            onChange={(event) => setClienteId(event.target.value)}
            className="h-10 rounded-md border border-[#4B2818]/20 bg-white px-3 font-bold"
          >
            <option value="">Seleccionar receptor</option>
            {clientes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.rut} · {item.razon_social}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-[#4B2818]">
          Fecha emisión
          <input
            type="date"
            value={fechaEmision}
            onChange={(event) => setFechaEmision(event.target.value)}
            className="h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold"
          />
        </label>
        <label className="grid gap-1 text-xs font-black text-[#4B2818]">
          Vencimiento
          <input
            type="date"
            value={fechaVencimiento}
            onChange={(event) => setFechaVencimiento(event.target.value)}
            className="h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold"
          />
        </label>
        <label className="grid gap-1 text-xs font-black text-[#4B2818]">
          Forma de pago
          <select
            value={formaPago}
            onChange={(event) => setFormaPago(event.target.value)}
            className="h-10 rounded-md border border-[#4B2818]/20 bg-white px-3 font-bold"
          >
            <option value="contado">Contado</option>
            <option value="credito">Crédito</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-[#4B2818] md:col-span-2 xl:col-span-3">
          Observaciones
          <input
            value={observaciones}
            onChange={(event) => setObservaciones(event.target.value)}
            className="h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold"
          />
        </label>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
        <div className="flex items-center justify-between border-b border-[#4B2818]/10 bg-[#FFF3DF] px-5 py-4">
          <h2 className="font-black text-[#2A1710]">Detalle</h2>
          <button
            type="button"
            onClick={() => setLineas((actuales) => [...actuales, nuevaLinea()])}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-[#2A1710] px-3 text-xs font-black text-white"
          >
            <Plus className="h-4 w-4" />
            Producto
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-[#4B2818]/10 text-xs uppercase text-[#4B2818]/60">
              <tr>
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-3 py-3 text-right">Cantidad</th>
                <th className="px-3 py-3 text-right">Precio neto</th>
                <th className="px-3 py-3 text-right">Descuento %</th>
                <th className="px-3 py-3 text-center">Exento</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4B2818]/10">
              {lineas.map((linea) => {
                const total =
                  linea.cantidad *
                  linea.precio_unitario *
                  (1 - linea.descuento_porcentaje / 100);
                return (
                  <tr key={linea.id}>
                    <td className="px-4 py-2">
                      <select
                        value={linea.producto_id}
                        onChange={(event) =>
                          cambiarProducto(linea.id, event.target.value)
                        }
                        className="h-9 w-full rounded-md border border-[#4B2818]/15 bg-white px-2 font-bold"
                      >
                        <option value="">Seleccionar producto</option>
                        {productos.map((producto) => (
                          <option key={producto.id} value={producto.id}>
                            {producto.codigo ? `${producto.codigo} · ` : ''}
                            {producto.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                    {(['cantidad', 'precio_unitario', 'descuento_porcentaje'] as const).map(
                      (campo) => (
                        <td key={campo} className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={linea[campo] || ''}
                            onChange={(event) =>
                              setLineas((actuales) =>
                                actuales.map((item) =>
                                  item.id === linea.id
                                    ? {
                                        ...item,
                                        [campo]: Number(event.target.value || 0),
                                      }
                                    : item
                                )
                              )
                            }
                            className="h-9 w-full rounded-md border border-[#4B2818]/15 px-2 text-right font-bold"
                          />
                        </td>
                      )
                    )}
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={linea.exento || tipoDte === 34}
                        disabled={tipoDte === 34}
                        onChange={(event) =>
                          setLineas((actuales) =>
                            actuales.map((item) =>
                              item.id === linea.id
                                ? { ...item, exento: event.target.checked }
                                : item
                            )
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-black">
                      ${Math.round(total).toLocaleString('es-CL')}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        title="Eliminar línea"
                        onClick={() =>
                          setLineas((actuales) =>
                            actuales.filter((item) => item.id !== linea.id)
                          )
                        }
                        className="grid h-8 w-8 place-items-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
        <div className="border-b border-[#4B2818]/10 bg-[#FFF3DF] px-5 py-4">
          <h2 className="font-black text-[#2A1710]">
            Documento de referencia
          </h2>
          <p className="mt-1 text-xs font-semibold text-[#4B2818]/60">
            Úsalo para facturar una guía o emitir notas de crédito y débito.
          </p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-1 text-xs font-black text-[#4B2818]">
            Tipo
            <select
              value={referencia.tipo}
              onChange={(event) =>
                setReferencia({ ...referencia, tipo: event.target.value })
              }
              className="h-10 rounded-md border border-[#4B2818]/20 bg-white px-3 font-bold"
            >
              <option value="">Sin referencia</option>
              <option value="33">Factura electrónica</option>
              <option value="34">Factura exenta</option>
              <option value="52">Guía de despacho</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-[#4B2818]">
            Folio
            <input
              value={referencia.folio}
              onChange={(event) =>
                setReferencia({ ...referencia, folio: event.target.value })
              }
              className="h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold"
            />
          </label>
          <label className="grid gap-1 text-xs font-black text-[#4B2818]">
            Fecha
            <input
              type="date"
              value={referencia.fecha}
              onChange={(event) =>
                setReferencia({ ...referencia, fecha: event.target.value })
              }
              className="h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold"
            />
          </label>
          <label className="grid gap-1 text-xs font-black text-[#4B2818]">
            Código referencia
            <select
              value={referencia.codigo}
              onChange={(event) =>
                setReferencia({ ...referencia, codigo: event.target.value })
              }
              className="h-10 rounded-md border border-[#4B2818]/20 bg-white px-3 font-bold"
            >
              <option value="">No aplica</option>
              <option value="1">Anula documento</option>
              <option value="2">Corrige texto</option>
              <option value="3">Corrige montos</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-[#4B2818]">
            Razón
            <input
              value={referencia.razon}
              onChange={(event) =>
                setReferencia({ ...referencia, razon: event.target.value })
              }
              className="h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold"
            />
          </label>
        </div>
      </section>

      <section className="ml-auto w-full max-w-sm rounded-lg border border-[#4B2818]/15 bg-white p-5">
        {[
          ['Neto', calculo.neto],
          ['Exento', calculo.exento],
          ['IVA', calculo.iva],
          ['Total', calculo.total],
        ].map(([etiqueta, valor]) => (
          <div
            key={etiqueta}
            className="flex justify-between border-b border-[#4B2818]/10 py-2 last:border-0"
          >
            <span className="font-bold text-[#4B2818]/65">{etiqueta}</span>
            <strong className="text-[#2A1710]">
              ${Number(valor).toLocaleString('es-CL')}
            </strong>
          </div>
        ))}
        <button
          type="button"
          onClick={guardarDocumento}
          disabled={guardando}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#A51F2B] font-black text-white disabled:opacity-60"
        >
          {guardando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar borrador
        </button>
      </section>
    </div>
  );
}
