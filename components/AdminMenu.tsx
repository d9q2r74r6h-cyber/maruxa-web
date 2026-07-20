'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  MessageCircle,
  ShieldCheck,
  UserCircle,
  X,
} from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';
import { supabase } from '@/lib/supabase';

type MenuItem = {
  label: string;
  href?: string;
  future?: boolean;
  modulo?: string;
};

const grupos: {
  id: string;
  label: string;
  items: MenuItem[];
}[] = [
  {
    id: 'comercial',
    label: 'Comercial',
    items: [
      { label: 'Pedidos', href: '/admin/pedidos', modulo: 'pedidos' },
      { label: 'WhatsApp Business', href: '/admin/whatsapp', modulo: 'whatsapp' },
      { label: 'Documentos tributarios', href: '/admin/documentos', modulo: 'documentos' },
      { label: 'Clientes', href: '/admin/clientes', modulo: 'clientes' },
      { label: 'Repartos mensuales', href: '/admin/repartos', modulo: 'repartos' },
    ],
  },
  {
    id: 'inventario',
    label: 'Inventario',
    items: [
      { label: 'Productos', href: '/admin/productos', modulo: 'productos' },
      { label: 'Proveedores', href: '/admin/proveedores' },
      { label: 'Costos y precios', href: '/admin/compras', modulo: 'compras' },
      { label: 'Vehículos', href: '/admin/vehiculos', modulo: 'vehiculos' },
      { label: 'Kardex / movimientos', future: true },
      { label: 'Historial de costos', future: true },
    ],
  },
  {
    id: 'produccion',
    label: 'Produccion',
    items: [
      { label: 'Recetas', href: '/admin/recetas', modulo: 'recetas' },
      { label: 'Fabricacion', href: '/admin/produccion', modulo: 'produccion' },
      { label: 'Rinde por saco', href: '/admin/planillas', modulo: 'planillas' },
      { label: 'Historial produccion', future: true },
    ],
  },
  {
    id: 'informes',
    label: 'Informes',
    items: [
      { label: 'Rinde mensual', href: '/admin/informes/rinde', modulo: 'informe_rinde' },
      { label: 'Listados de precios', href: '/admin/informes/precios', modulo: 'compras' },
      { label: 'Productos por proveedor', href: '/admin/informes/productos-proveedor', modulo: 'compras' },
      { label: 'Rendimiento de vehículos', href: '/admin/informes/rendimiento-vehiculos', modulo: 'rendimiento_vehiculos' },
      { label: 'Combustible de hornos', href: '/admin/informes/combustible-hornos', modulo: 'combustible_hornos' },
      { label: 'Costos', future: true },
      { label: 'Rentabilidad', future: true },
      { label: 'Stock critico', future: true },
      { label: 'Ventas por periodo', future: true },
    ],
  },
  {
    id: 'config',
    label: 'Configuracion',
    items: [
      { label: 'Familias de productos', href: '/admin/familias-productos', modulo: 'familias' },
      { label: 'Empresa', href: '/admin/configuracion', modulo: 'empresa' },
      { label: 'Politica de precios', future: true },
      { label: 'Usuarios y permisos', href: '/admin/usuarios', modulo: 'usuarios' },
      { label: 'Auditoria', href: '/admin/auditoria', modulo: 'auditoria' },
    ],
  },
];

export function AdminMenu() {
  const pathname = usePathname();
  const { perfil, puedeVer, cerrarSesion } = useAdminSession();
  const [open, setOpen] = useState<string | null>(null);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [alertasVehiculos, setAlertasVehiculos] = useState(0);
  const [permisoNotificaciones, setPermisoNotificaciones] =
    useState<NotificationPermission | 'no-soportado'>('default');
  const menuRef = useRef<HTMLElement | null>(null);
  const pendientesPreviosRef = useRef<number | null>(null);
  const ultimoEventoNotificadoRef = useRef<string | null>(null);
  const ultimaAlertaVehiculoRef = useRef<string | null>(null);

  useEffect(() => {
    function cerrarSiClickAfuera(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(null);
      }
    }

    document.addEventListener('mousedown', cerrarSiClickAfuera);

    return () => {
      document.removeEventListener('mousedown', cerrarSiClickAfuera);
    };
  }, []);

  useEffect(() => {
    setMenuMovilAbierto(false);
    setOpen(null);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setPermisoNotificaciones(
      'Notification' in window ? Notification.permission : 'no-soportado'
    );
  }, []);

  useEffect(() => {
    if (!perfil?.empresa_id || !puedeVer('whatsapp')) {
      setPendientes(0);
      return;
    }

    async function cargarPendientes() {
      const { data } = await supabase
        .from('whatsapp_eventos')
        .select('id,tipo,estado,created_at,telefono')
        .eq('empresa_id', perfil.empresa_id)
        .neq('tipo', 'order')
        .neq('tipo', 'aviso_administrador')
        .neq('tipo', 'respuesta')
        .order('created_at', { ascending: false })
        .limit(100);

      const { data: instagramData } = await supabase
        .from('instagram_eventos')
        .select('id,estado,created_at,sender_id')
        .eq('empresa_id', perfil.empresa_id)
        .order('created_at', { ascending: false })
        .limit(100);

      const pendientesWhatsapp = (data || []).filter(
        (evento) =>
          evento.estado !== 'respondido' &&
          evento.estado !== 'leido' &&
          evento.estado !== 'informativo'
      );
      const pendientesInstagram = (instagramData || []).filter(
        (evento) =>
          evento.estado !== 'respondido' &&
          evento.estado !== 'leido' &&
          evento.estado !== 'informativo'
      );
      const totalPendientes =
        pendientesWhatsapp.length + pendientesInstagram.length;
      const ultimoWhatsapp = pendientesWhatsapp[0];
      const ultimoInstagram = pendientesInstagram[0];
      const ultimoEsInstagram =
        ultimoInstagram &&
        (!ultimoWhatsapp ||
          new Date(ultimoInstagram.created_at).getTime() >
            new Date(ultimoWhatsapp.created_at).getTime());
      const ultimoEvento = ultimoEsInstagram ? ultimoInstagram : ultimoWhatsapp;
      const ultimoEventoClave = ultimoEvento
        ? `${ultimoEsInstagram ? 'instagram' : 'whatsapp'}-${ultimoEvento.id}`
        : null;
      const claveUltimoAviso = `maruxa-ultimo-aviso-${perfil.empresa_id}`;
      const ultimoEventoPersistido =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(claveUltimoAviso)
          : null;
      const ultimoEventoAnterior =
        ultimoEventoNotificadoRef.current || ultimoEventoPersistido;
      const hayEventoNuevo = Boolean(
        ultimoEventoClave && ultimoEventoClave !== ultimoEventoAnterior
      );

      if (
        hayEventoNuevo &&
        ultimoEvento &&
        pathname !== '/admin/whatsapp'
      ) {
        const origen = ultimoEsInstagram ? 'Instagram' : 'WhatsApp';
        const remitente = ultimoEsInstagram
          ? ultimoInstagram?.sender_id || 'Instagram'
          : ultimoWhatsapp?.telefono || 'WhatsApp';
        const cantidadNuevos =
          pendientesPreviosRef.current === null
            ? 1
            : Math.max(1, totalPendientes - pendientesPreviosRef.current);
        const titulo =
          cantidadNuevos > 1
            ? `${cantidadNuevos} mensajes nuevos pendientes`
            : 'Nuevo mensaje pendiente';

        toast.info(titulo, {
          description: `${origen}: ${remitente}`,
          duration: 10000,
          action: {
            label: 'Abrir',
            onClick: () => {
              window.location.href = '/admin/whatsapp';
            },
          },
        });

        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          const notificacion = new Notification(titulo, {
            body: `${origen}: ${remitente}`,
            icon: '/apple-touch-icon.png',
            tag: `maruxa-mensajes-pendientes-${ultimoEventoClave}`,
          });
          notificacion.onclick = () => {
            window.focus();
            window.location.href = '/admin/whatsapp';
          };
        }
      }

      if (ultimoEventoClave) {
        ultimoEventoNotificadoRef.current = ultimoEventoClave;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(claveUltimoAviso, ultimoEventoClave);
        }
      }
      pendientesPreviosRef.current = totalPendientes;
      setPendientes(totalPendientes);
    }

    cargarPendientes();
    const intervalo = window.setInterval(cargarPendientes, 15000);
    const canal = supabase
      .channel(`avisos-admin-${perfil?.empresa_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_eventos',
          filter: `empresa_id=eq.${perfil?.empresa_id}`,
        },
        cargarPendientes
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_eventos',
          filter: `empresa_id=eq.${perfil?.empresa_id}`,
        },
        cargarPendientes
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'instagram_eventos',
          filter: `empresa_id=eq.${perfil?.empresa_id}`,
        },
        cargarPendientes
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'instagram_eventos',
          filter: `empresa_id=eq.${perfil?.empresa_id}`,
        },
        cargarPendientes
      )
      .subscribe();

    return () => {
      window.clearInterval(intervalo);
      supabase.removeChannel(canal);
    };
  }, [pathname, perfil?.empresa_id, puedeVer]);

  useEffect(() => {
    if (!perfil?.empresa_id || !puedeVer('vehiculos')) {
      setAlertasVehiculos(0);
      return;
    }

    async function cargarAlertasVehiculos() {
      const [vehiculosResp, politicasResp, registrosResp] = await Promise.all([
        supabase
          .from('vehiculos_reparto')
          .select('id,nombre,kilometraje_actual,revision_tecnica_vence,permiso_circulacion_vence,seguro_vence')
          .eq('empresa_id', perfil!.empresa_id)
          .eq('activo', true),
        supabase
          .from('vehiculo_alerta_politicas')
          .select('id,codigo,dias_anticipacion,km_anticipacion')
          .eq('empresa_id', perfil!.empresa_id)
          .eq('activo', true),
        supabase
          .from('vehiculo_registros')
          .select('id,vehiculo_id,politica_id,titulo,proxima_fecha,proximo_kilometraje')
          .eq('empresa_id', perfil!.empresa_id),
      ]);
      if (vehiculosResp.error || politicasResp.error || registrosResp.error) return;

      const politicas = politicasResp.data || [];
      const registros = registrosResp.data || [];
      const hoy = new Date();
      hoy.setHours(12, 0, 0, 0);
      const avisos: Array<{ clave: string; texto: string }> = [];
      const diasHasta = (valor: string) => Math.ceil(
        (new Date(`${valor}T12:00:00`).getTime() - hoy.getTime()) / 86400000
      );

      (vehiculosResp.data || []).forEach((vehiculo) => {
        const documentos = [
          ['revision_tecnica', 'Revisión técnica', vehiculo.revision_tecnica_vence],
          ['permiso_circulacion', 'Permiso de circulación', vehiculo.permiso_circulacion_vence],
          ['seguro', 'Seguro obligatorio', vehiculo.seguro_vence],
        ] as const;
        documentos.forEach(([codigo, nombre, vencimiento]) => {
          if (!vencimiento) return;
          const dias = diasHasta(vencimiento);
          const politica = politicas.find((item) => item.codigo === codigo);
          if (dias <= (politica?.dias_anticipacion ?? 30)) {
            avisos.push({
              clave: `${vehiculo.id}-${codigo}-${vencimiento}`,
              texto: dias < 0
                ? `${vehiculo.nombre}: ${nombre.toLowerCase()} vencida`
                : `${vehiculo.nombre}: ${nombre.toLowerCase()} vence en ${dias} días`,
            });
          }
        });
        registros.filter((registro) => registro.vehiculo_id === vehiculo.id).forEach((registro) => {
          const politica = politicas.find((item) => item.id === registro.politica_id);
          if (registro.proxima_fecha) {
            const dias = diasHasta(registro.proxima_fecha);
            if (dias <= (politica?.dias_anticipacion ?? 30)) avisos.push({
              clave: `${registro.id}-fecha-${registro.proxima_fecha}`,
              texto: dias < 0
                ? `${vehiculo.nombre}: ${registro.titulo} vencida`
                : `${vehiculo.nombre}: ${registro.titulo} en ${dias} días`,
            });
          }
          if (registro.proximo_kilometraje) {
            const faltan = Number(registro.proximo_kilometraje) - Number(vehiculo.kilometraje_actual || 0);
            if (faltan <= (politica?.km_anticipacion ?? 500)) avisos.push({
              clave: `${registro.id}-km-${registro.proximo_kilometraje}`,
              texto: faltan <= 0
                ? `${vehiculo.nombre}: ${registro.titulo} por kilometraje`
                : `${vehiculo.nombre}: ${registro.titulo} en ${faltan.toLocaleString('es-CL')} km`,
            });
          }
        });
      });

      setAlertasVehiculos(avisos.length);
      if (!avisos.length || pathname === '/admin/vehiculos') return;
      const firma = avisos.map((aviso) => aviso.clave).sort().join('|');
      const claveLocal = `maruxa-alertas-vehiculos-${perfil!.empresa_id}`;
      const firmaAnterior = ultimaAlertaVehiculoRef.current || window.localStorage.getItem(claveLocal);
      if (firma !== firmaAnterior) {
        const titulo = avisos.length === 1 ? 'Alerta de vehículo' : `${avisos.length} alertas de vehículos`;
        toast.warning(titulo, {
          description: avisos[0].texto,
          duration: 12000,
          action: { label: 'Abrir', onClick: () => { window.location.href = '/admin/vehiculos'; } },
        });
        if ('Notification' in window && Notification.permission === 'granted') {
          const notificacion = new Notification(titulo, {
            body: avisos[0].texto,
            icon: '/apple-touch-icon.png',
            tag: `maruxa-alertas-vehiculos-${firma}`,
          });
          notificacion.onclick = () => {
            window.focus();
            window.location.href = '/admin/vehiculos';
          };
        }
        ultimaAlertaVehiculoRef.current = firma;
        window.localStorage.setItem(claveLocal, firma);
      }
    }

    void cargarAlertasVehiculos();
    const intervalo = window.setInterval(cargarAlertasVehiculos, 60000);
    return () => window.clearInterval(intervalo);
  }, [pathname, perfil?.empresa_id, puedeVer]);

  async function activarNotificaciones() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermisoNotificaciones('no-soportado');
      alert('Este navegador no soporta notificaciones.');
      return;
    }

    const permiso = await Notification.requestPermission();
    setPermisoNotificaciones(permiso);

    if (permiso === 'granted') {
      new Notification('Notificaciones activadas', {
        body: 'Te avisaremos sobre mensajes pendientes y alertas de vehículos.',
        icon: '/apple-touch-icon.png',
        tag: 'maruxa-notificaciones-activadas',
      });
    }
  }

  function esActivo(href?: string) {
    if (!href) return false;
    if (href === '/admin') return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav
      ref={menuRef}
      className="relative z-40 mb-8 rounded-2xl border border-[#A51F2B]/10 bg-white/95 px-3 py-2 shadow-sm backdrop-blur"
    >
      <div className="flex items-center justify-between gap-2 md:hidden">
        <Link
          href="/admin"
          className="rounded-xl bg-[#2A1710] px-3.5 py-2 text-sm font-black text-white"
        >
          Maruxa ERP
        </Link>

        <div className="flex items-center gap-1">
          {puedeVer('vehiculos') && (
            <Link
              href="/admin/vehiculos"
              title={alertasVehiculos ? `${alertasVehiculos} alertas de vehículos` : 'Sin alertas de vehículos'}
              className={`relative grid h-10 w-10 place-items-center rounded-xl ${alertasVehiculos ? 'bg-red-100 text-red-800' : 'bg-[#FFF3DF] text-[#A51F2B]'}`}
            >
              <AlertTriangle className="h-4 w-4" />
              {alertasVehiculos > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-700 px-1 text-[10px] font-black text-white ring-2 ring-white">{alertasVehiculos > 99 ? '99+' : alertasVehiculos}</span>}
            </Link>
          )}
          {puedeVer('whatsapp') && (
            <Link
              href="/admin/whatsapp"
              title="WhatsApp Business"
              className={`relative grid h-10 w-10 place-items-center rounded-xl ${
                pendientes > 0
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-[#FFF3DF] text-[#A51F2B]'
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              {pendientes > 0 && (
                <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#A51F2B] px-1 text-[10px] font-black text-white ring-2 ring-white">
                  {pendientes > 99 ? '99+' : pendientes}
                </span>
              )}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMenuMovilAbierto((abierto) => !abierto)}
            aria-expanded={menuMovilAbierto}
            aria-label={menuMovilAbierto ? 'Cerrar menu' : 'Abrir menu'}
            className="grid h-10 w-10 place-items-center rounded-xl bg-[#A51F2B] text-white"
          >
            {menuMovilAbierto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuMovilAbierto && (
        <div className="mt-3 max-h-[calc(100dvh-8rem)] space-y-3 overflow-y-auto border-t border-[#A51F2B]/10 pt-3 md:hidden">
          {grupos.map((grupo) => {
            const itemsVisibles = grupo.items.filter(
              (item) => item.future || !item.modulo || puedeVer(item.modulo)
            );

            if (itemsVisibles.length === 0) return null;

            return (
              <section key={grupo.id} className="rounded-xl bg-[#FFF8EC] p-2">
                <p className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-[#A51F2B]">
                  {grupo.label}
                </p>
                <div className="grid gap-1">
                  {itemsVisibles.map((item) =>
                    item.future ? (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold text-gray-400"
                      >
                        {item.label}
                        <span className="text-[9px] uppercase">Proximo</span>
                      </div>
                    ) : (
                      <Link
                        key={item.href}
                        href={item.href || '#'}
                        className={`rounded-lg px-3 py-2.5 text-sm font-black ${
                          esActivo(item.href)
                            ? 'bg-[#A51F2B] text-white'
                            : 'bg-white text-[#4B2818]'
                        }`}
                      >
                        {item.label}
                      </Link>
                    )
                  )}
                </div>
              </section>
            );
          })}

          <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-[#A51F2B]/10 pt-3">
            <Link
              href="/admin/perfil"
              className="flex min-w-0 items-center gap-2 rounded-xl bg-[#FFF3DF] px-3 py-2"
            >
              <UserCircle className="h-5 w-5 shrink-0 text-[#A51F2B]" />
              <span className="truncate text-xs font-black text-[#2A1710]">
                {perfil?.funcionarios?.nombre_completo || perfil?.nombre_visible}
              </span>
            </Link>
            <button
              type="button"
              onClick={cerrarSesion}
              className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-700"
              aria-label="Cerrar sesion"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="hidden flex-wrap items-center gap-1.5 text-sm font-black text-[#2A1710] md:flex">
        <Link
          href="/admin"
          className={`rounded-xl px-3.5 py-2 transition ${
            esActivo('/admin')
              ? 'bg-[#2A1710] text-white shadow-sm'
              : 'text-[#4B2818] hover:bg-[#FFF3DF] hover:text-[#A51F2B]'
          }`}
        >
          Inicio
        </Link>

        {grupos.map((grupo) => {
          const itemsVisibles = grupo.items.filter(
            (item) => item.future || !item.modulo || puedeVer(item.modulo)
          );
          const activo = itemsVisibles.some((item) => esActivo(item.href));
          const abierto = open === grupo.id;

          if (itemsVisibles.length === 0) return null;

          return (
            <div key={grupo.id} className="relative">
              <button
                type="button"
                onClick={() => setOpen(abierto ? null : grupo.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 transition ${
                  activo
                    ? 'bg-[#2A1710] text-white shadow-sm'
                    : abierto
                      ? 'bg-[#FFF3DF] text-[#A51F2B]'
                      : 'text-[#4B2818] hover:bg-[#FFF3DF] hover:text-[#A51F2B]'
                }`}
              >
                <span>{grupo.label}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`h-4 w-4 transition-transform ${abierto ? 'rotate-180' : ''}`}
                />
              </button>

              {abierto && (
                <div className="absolute left-0 top-[calc(100%+0.5rem)] z-[100] w-[min(18rem,calc(100vw-2.5rem))] overflow-hidden rounded-xl border border-[#A51F2B]/15 bg-white text-[#2A1710] shadow-[0_18px_45px_rgba(42,23,16,0.2)]">
                  <div className="border-b border-[#A51F2B]/10 bg-[#FFF3DF] px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-wide text-[#A51F2B]">
                      {grupo.label}
                    </p>
                  </div>

                  <div className="p-2">
                    {itemsVisibles.map((item) =>
                      item.future ? (
                        <div
                          key={item.label}
                          className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-gray-400"
                        >
                          <span>{item.label}</span>
                          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
                            Proximo
                          </span>
                        </div>
                      ) : (
                        <Link
                          key={item.href}
                          href={item.href || '#'}
                          onClick={() => setOpen(null)}
                          className={`block rounded-lg px-3 py-2.5 transition ${
                            esActivo(item.href)
                              ? 'bg-[#A51F2B] text-white'
                              : 'text-[#4B2818] hover:bg-[#FFF3DF] hover:text-[#A51F2B]'
                          }`}
                        >
                          {item.label}
                        </Link>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="ml-auto flex items-center gap-1 border-l border-[#4B2818]/10 pl-2">
          {(puedeVer('whatsapp') || puedeVer('vehiculos')) && permisoNotificaciones === 'default' && (
            <button
              type="button"
              onClick={activarNotificaciones}
              title="Activar notificaciones"
              className="hidden rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-black text-amber-800 transition hover:bg-amber-100 md:inline-flex"
            >
              Activar avisos
            </button>
          )}

          {puedeVer('whatsapp') && (
            <Link
              href="/admin/whatsapp"
              title={
                pendientes > 0
                  ? `${pendientes} pendiente${pendientes === 1 ? '' : 's'} en WhatsApp`
                  : 'Sin pendientes en WhatsApp'
              }
              className={`relative grid h-9 w-9 place-items-center rounded-lg transition ${
                pendientes > 0
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'text-[#4B2818]/60 hover:bg-[#FFF3DF] hover:text-[#A51F2B]'
              }`}
            >
              {pendientes > 0 ? (
                <Bell className="h-4 w-4" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              {pendientes > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#A51F2B] px-1 text-[10px] font-black text-white ring-2 ring-white">
                  {pendientes > 99 ? '99+' : pendientes}
                </span>
              )}
            </Link>
          )}

          {puedeVer('vehiculos') && (
            <Link
              href="/admin/vehiculos"
              title={alertasVehiculos ? `${alertasVehiculos} alerta${alertasVehiculos === 1 ? '' : 's'} de vehículos` : 'Sin alertas de vehículos'}
              className={`relative grid h-9 w-9 place-items-center rounded-lg transition ${alertasVehiculos ? 'bg-red-100 text-red-800 hover:bg-red-200' : 'text-[#4B2818]/60 hover:bg-[#FFF3DF] hover:text-[#A51F2B]'}`}
            >
              <AlertTriangle className="h-4 w-4" />
              {alertasVehiculos > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-700 px-1 text-[10px] font-black text-white ring-2 ring-white">{alertasVehiculos > 99 ? '99+' : alertasVehiculos}</span>}
            </Link>
          )}

          <Link
            href="/admin/perfil"
            title="Mi perfil"
            className="flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-[#FFF3DF]"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#A51F2B] text-white">
              <UserCircle className="h-5 w-5" />
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-40 truncate text-xs font-black text-[#2A1710]">
                {perfil?.funcionarios?.nombre_completo ||
                  perfil?.nombre_visible}
              </p>
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#A51F2B]">
                <ShieldCheck className="h-3 w-3" />
                {perfil?.funcionarios?.cargo || perfil?.rol}
              </p>
            </div>
          </Link>
          <button
            type="button"
            title="Cerrar sesión"
            onClick={cerrarSesion}
            className="grid h-9 w-9 place-items-center rounded-lg text-[#4B2818]/60 transition hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
