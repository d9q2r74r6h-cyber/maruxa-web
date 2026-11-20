'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Clock3,
  Loader2,
  Package,
  ShoppingBag,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';
import { supabase } from '@/lib/supabase';
import { obtenerStockCritico } from '@/lib/stock-critico';

type PedidoResumen = {
  id: number;
  cliente: string;
  total: number;
  estado: string;
  fecha_retiro: string;
  hora_retiro: string;
  created_at: string | null;
};

type ProductoStock = {
  id: number;
  nombre: string;
  codigo: string | null;
  unidad_base: string | null;
  stock_actual: number | null;
  stock_minimo: number | null;
  controla_stock: boolean | null;
  costo_unitario: number | null;
};

type CajaResumen = {
  fecha: string;
  estado: 'borrador' | 'cerrada';
  total_ventas: number | null;
};

function fechaChile(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value || '';

  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

function moverFecha(fecha: string, dias: number) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const valor = new Date(Date.UTC(anio, mes - 1, dia));
  valor.setUTCDate(valor.getUTCDate() + dias);
  return valor.toISOString().slice(0, 10);
}

function dinero(valor: number) {
  return `$${Math.round(valor || 0).toLocaleString('es-CL')}`;
}

function fechaCorta(fecha: string) {
  if (!fecha) return 'Sin fecha';
  return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CL', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

function estadoPedido(estado: string) {
  return String(estado || 'pendiente').replaceAll('_', ' ');
}

export function AdminInicioDashboard() {
  const { perfil, cargando: cargandoSesion, puedeVer } = useAdminSession();
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([]);
  const [productos, setProductos] = useState<ProductoStock[]>([]);
  const [cajas, setCajas] = useState<CajaResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const puedeVerPedidos = puedeVer('pedidos');
  const puedeVerProductos = puedeVer('productos');
  const hoy = useMemo(() => fechaChile(), []);
  const ayer = useMemo(() => moverFecha(hoy, -1), [hoy]);
  const mesActual = hoy.slice(0, 7);
  const nombreSaludo =
    perfil?.funcionarios?.nombre_completo?.trim() ||
    perfil?.nombre_visible
      ?.replace(/^(administrador|admin|superadmin)\s+/i, '')
      .trim() ||
    'Maruxa';

  useEffect(() => {
    if (!perfil) return;
    let activo = true;

    async function cargarResumen() {
      setCargando(true);
      setError('');

      const consultaPedidos = puedeVerPedidos
        ? supabase
            .from('pedidos')
            .select('id,cliente,total,estado,fecha_retiro,hora_retiro,created_at')
            .eq('empresa_id', perfil.empresa_id)
            .order('created_at', { ascending: false })
            .limit(250)
        : Promise.resolve({ data: [], error: null });
      const consultaProductos = puedeVerProductos
        ? supabase
            .from('productos')
            .select('id,nombre,codigo,unidad_base,stock_actual,stock_minimo,controla_stock,costo_unitario')
            .eq('empresa_id', perfil.empresa_id)
            .eq('activo', true)
            .limit(1000)
        : Promise.resolve({ data: [], error: null });
      const consultaCaja = supabase
        .from('caja_cierres')
        .select('fecha,estado,total_ventas')
        .eq('empresa_id', perfil.empresa_id)
        .in('fecha', [hoy, ayer]);

      const [resultadoPedidos, resultadoProductos, resultadoCaja] = await Promise.all([
        consultaPedidos,
        consultaProductos,
        consultaCaja,
      ]);

      if (!activo) return;

      if (resultadoPedidos.error || resultadoProductos.error || resultadoCaja.error) {
        setError(
          resultadoPedidos.error?.message ||
            resultadoProductos.error?.message ||
            resultadoCaja.error?.message ||
            'No pudimos cargar el resumen del día.'
        );
      }

      setPedidos((resultadoPedidos.data || []) as PedidoResumen[]);
      setProductos((resultadoProductos.data || []) as ProductoStock[]);
      setCajas((resultadoCaja.data || []) as CajaResumen[]);
      setCargando(false);
    }

    void cargarResumen();
    return () => {
      activo = false;
    };
  }, [perfil, puedeVerPedidos, puedeVerProductos, hoy, ayer]);

  const pedidosPendientes = pedidos.filter((pedido) => pedido.estado === 'pendiente');
  const retirosHoy = pedidos.filter(
    (pedido) =>
      pedido.fecha_retiro === hoy &&
      !['entregado', 'cancelado', 'anulado'].includes(pedido.estado)
  );
  const montoMes = pedidos
    .filter(
      (pedido) =>
        pedido.created_at?.slice(0, 7) === mesActual &&
        !['cancelado', 'anulado'].includes(pedido.estado)
    )
    .reduce((total, pedido) => total + Number(pedido.total || 0), 0);
  const stockCritico = obtenerStockCritico(
    productos.map((producto) => ({
      id: producto.id,
      nombre: producto.nombre,
      codigo: producto.codigo,
      unidadBase: producto.unidad_base,
      stockActual: producto.stock_actual,
      stockMinimo: producto.stock_minimo,
      controlaStock: producto.controla_stock,
      costoUnitario: producto.costo_unitario,
      origen: 'productos' as const,
    }))
  );
  const proximosPendientes = [...pedidosPendientes]
    .sort(
      (a, b) =>
        `${a.fecha_retiro}T${a.hora_retiro}`.localeCompare(
          `${b.fecha_retiro}T${b.hora_retiro}`
        )
    )
    .slice(0, 5);
  const cajaHoy = cajas.find((caja) => caja.fecha === hoy) || null;
  const cajaAyer = cajas.find((caja) => caja.fecha === ayer) || null;

  function resumenCaja(caja: CajaResumen | null, fecha: string) {
    return {
      valor: caja
        ? caja.estado === 'cerrada'
          ? 'Cerrada'
          : 'Borrador'
        : 'Sin abrir',
      detalle: caja
        ? `Vale registrado: ${dinero(caja.total_ventas || 0)}.`
        : `Sin caja registrada para ${fechaCorta(fecha)}.`,
      tono: caja?.estado === 'cerrada'
        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
        : caja
          ? 'bg-amber-50 text-amber-900 border-amber-200'
          : 'bg-stone-50 text-stone-800 border-stone-200',
    };
  }
  const resumenCajaHoy = resumenCaja(cajaHoy, hoy);
  const resumenCajaAyer = resumenCaja(cajaAyer, ayer);

  const tarjetas = [
    {
      titulo: 'Caja de hoy',
      ...resumenCajaHoy,
      href: `/admin/caja?fecha=${hoy}`,
      icono: WalletCards,
    },
    {
      titulo: 'Caja de ayer',
      ...resumenCajaAyer,
      href: `/admin/caja?fecha=${ayer}`,
      icono: WalletCards,
    },
    ...(puedeVerPedidos
      ? [
          {
            titulo: 'Pendientes',
            valor: pedidosPendientes.length.toLocaleString('es-CL'),
            detalle: 'Pedidos que requieren revisión.',
            href: '/admin/pedidos',
            icono: ClipboardList,
            tono: 'bg-amber-50 text-amber-900 border-amber-200',
          },
          {
            titulo: 'Retiros de hoy',
            valor: retirosHoy.length.toLocaleString('es-CL'),
            detalle: `Para ${fechaCorta(hoy)}.`,
            href: '/admin/pedidos',
            icono: Clock3,
            tono: 'bg-sky-50 text-sky-900 border-sky-200',
          },
          {
            titulo: 'Solicitado este mes',
            valor: dinero(montoMes),
            detalle: 'Total de pedidos web registrados.',
            href: '/admin/pedidos',
            icono: TrendingUp,
            tono: 'bg-emerald-50 text-emerald-900 border-emerald-200',
          },
        ]
      : []),
    ...(puedeVerProductos
      ? [
          {
            titulo: 'Stock de productos',
            valor: stockCritico.length.toLocaleString('es-CL'),
            detalle: 'Agotados o bajo mínimo.',
            href: '/admin/informes/stock-critico',
            icono: AlertTriangle,
            tono: stockCritico.length
              ? 'bg-red-50 text-red-900 border-red-200'
              : 'bg-stone-50 text-stone-800 border-stone-200',
          },
        ]
      : []),
  ];

  if (cargandoSesion) {
    return (
      <div className="grid min-h-[45vh] place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-maruxa-rojo" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <header className="rounded-[30px] bg-[#2A1710] px-6 py-7 text-white shadow-premium sm:px-8 sm:py-9">
        <p className="text-xs font-black uppercase tracking-[.22em] text-white/70">
          Inicio privado
        </p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-[-.04em] sm:text-4xl">
              Hola, {nombreSaludo}
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/80">
              Revisa lo más importante antes de continuar con la operación.
            </p>
          </div>
          <p className="rounded-full bg-white/15 px-4 py-2 text-sm font-black capitalize text-white">
            {fechaCorta(hoy)}
          </p>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-950">
          Mostramos lo que fue posible cargar. {error}
        </div>
      )}

      {cargando ? (
        <div className="flex items-center gap-3 rounded-2xl border border-maruxa-cafe/10 bg-white p-6 font-black text-maruxa-cafe/70 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-maruxa-rojo" /> Cargando resumen…
        </div>
      ) : (
        <>
          {tarjetas.length > 0 && (
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {tarjetas.map((tarjeta) => {
                const Icono = tarjeta.icono;
                return (
                  <Link
                    key={tarjeta.titulo}
                    href={tarjeta.href}
                    className={`rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tarjeta.tono}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide opacity-70">
                          {tarjeta.titulo}
                        </p>
                        <p className="mt-3 text-3xl font-black tracking-tight">
                          {tarjeta.valor}
                        </p>
                      </div>
                      <Icono className="h-6 w-6 opacity-75" />
                    </div>
                    <p className="mt-3 text-sm font-bold opacity-75">{tarjeta.detalle}</p>
                  </Link>
                );
              })}
            </section>
          )}

          <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
            {puedeVerPedidos && (
              <div className="overflow-hidden rounded-2xl border border-maruxa-cafe/15 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-maruxa-cafe/10 px-5 py-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-maruxa-rojo">Operación</p>
                    <h2 className="mt-1 text-xl font-black text-maruxa-chocolate">Próximos pedidos pendientes</h2>
                  </div>
                  <Link href="/admin/pedidos" className="inline-flex items-center gap-1 text-sm font-black text-maruxa-rojo hover:underline">
                    Ver pedidos <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                {proximosPendientes.length === 0 ? (
                  <p className="p-6 text-sm font-bold text-maruxa-cafe/65">
                    No hay pedidos pendientes por revisar.
                  </p>
                ) : (
                  <div className="divide-y divide-maruxa-cafe/10">
                    {proximosPendientes.map((pedido) => (
                      <Link
                        key={pedido.id}
                        href="/admin/pedidos"
                        className="flex flex-col gap-2 px-5 py-4 transition hover:bg-maruxa-crema/45 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-black text-maruxa-chocolate">#{pedido.id} · {pedido.cliente}</p>
                          <p className="mt-1 text-sm font-bold text-maruxa-cafe/65">
                            Retiro {fechaCorta(pedido.fecha_retiro)} · {pedido.hora_retiro}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 sm:text-right">
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black capitalize text-amber-900">
                            {estadoPedido(pedido.estado)}
                          </span>
                          <span className="font-black text-maruxa-chocolate">{dinero(pedido.total)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-maruxa-cafe/15 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-maruxa-rojo">Accesos rápidos</p>
              <h2 className="mt-1 text-xl font-black text-maruxa-chocolate">Continuar trabajando</h2>
              <div className="mt-5 grid gap-2">
                <Link href="/admin/caja" className="flex items-center justify-between rounded-xl bg-maruxa-crema px-4 py-3 font-black text-maruxa-chocolate transition hover:bg-maruxa-rojo/10">
                  Abrir caja diaria <WalletCards className="h-5 w-5 text-maruxa-rojo" />
                </Link>
                {puedeVerPedidos && (
                  <Link href="/admin/pedidos" className="flex items-center justify-between rounded-xl bg-maruxa-crema px-4 py-3 font-black text-maruxa-chocolate transition hover:bg-maruxa-rojo/10">
                    Gestionar pedidos <ClipboardList className="h-5 w-5 text-maruxa-rojo" />
                  </Link>
                )}
                {puedeVerProductos && (
                  <>
                    <Link href="/admin/productos" className="flex items-center justify-between rounded-xl bg-maruxa-crema px-4 py-3 font-black text-maruxa-chocolate transition hover:bg-maruxa-rojo/10">
                      Productos y catálogo <Package className="h-5 w-5 text-maruxa-rojo" />
                    </Link>
                    <Link href="/admin/informes/stock-critico" className="flex items-center justify-between rounded-xl bg-maruxa-crema px-4 py-3 font-black text-maruxa-chocolate transition hover:bg-maruxa-rojo/10">
                      Revisar stock <AlertTriangle className="h-5 w-5 text-maruxa-rojo" />
                    </Link>
                  </>
                )}
                {puedeVer('compras') && (
                  <Link href="/admin/compras" className="flex items-center justify-between rounded-xl bg-maruxa-crema px-4 py-3 font-black text-maruxa-chocolate transition hover:bg-maruxa-rojo/10">
                    Registrar compra <ShoppingBag className="h-5 w-5 text-maruxa-rojo" />
                  </Link>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
