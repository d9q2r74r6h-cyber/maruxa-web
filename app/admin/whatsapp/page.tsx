'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Clock,
  Landmark,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';

type WhatsappEvento = {
  id: string;
  origen?: 'whatsapp' | 'instagram';
  created_at: string;
  telefono: string | null;
  sender_id?: string | null;
  tipo: string | null;
  estado: string | null;
  observacion: string | null;
  pedido_id: number | null;
  message_id: string | null;
  texto?: string | null;
  payload: any;
};

type Conversacion = {
  clave: string;
  telefono: string;
  nombre: string;
  canalPhoneNumberId: string | null;
  canalTelefono: string | null;
  canalEtiqueta: string;
  eventos: WhatsappEvento[];
  pendientes: number;
  ultimoEvento: WhatsappEvento;
};

type CanalActivo = 'whatsapp' | 'instagram' | 'todos';

type CuentaBancaria = {
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  titular: string;
  rut_titular: string | null;
  email_notificacion: string | null;
};

function textoCuentaBancaria(cuenta: CuentaBancaria) {
  return [
    'Datos para transferencia:',
    `Banco: ${cuenta.banco}`,
    `Tipo de cuenta: ${cuenta.tipo_cuenta}`,
    `Numero de cuenta: ${cuenta.numero_cuenta}`,
    `Titular: ${cuenta.titular}`,
    cuenta.rut_titular ? `RUT: ${cuenta.rut_titular}` : null,
    cuenta.email_notificacion ? `Correo: ${cuenta.email_notificacion}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function valoresPayload(evento: WhatsappEvento) {
  if (evento.origen === 'instagram') {
    return {
      mensaje: null,
      contacto: null,
    };
  }

  const cambios =
    evento.payload?.entry?.flatMap((entrada: any) =>
      (entrada.changes || []).map((cambio: any) => cambio.value)
    ) || [];

  for (const valor of cambios) {
    const mensaje = (valor.messages || []).find(
      (item: any) => item.id === evento.message_id
    );

    if (mensaje) {
      return {
        mensaje,
        contacto: valor.contacts?.[0],
      };
    }
  }

  return {
    mensaje: null,
    contacto: cambios[0]?.contacts?.[0] || null,
  };
}

function datosCanalWhatsapp(evento: WhatsappEvento) {
  if (evento.origen === 'instagram') {
    return {
      phoneNumberId: null,
      telefono: null,
      etiqueta: 'Instagram',
    };
  }

  const cambios =
    evento.payload?.entry?.flatMap((entrada: any) =>
      (entrada.changes || []).map((cambio: any) => cambio.value)
    ) || [];
  const valorMensaje = cambios.find((valor: any) =>
    (valor.messages || []).some((mensaje: any) => mensaje.id === evento.message_id)
  );
  const metadata = valorMensaje?.metadata || cambios[0]?.metadata;

  return {
    phoneNumberId:
      evento.payload?.canal_phone_number_id || metadata?.phone_number_id || null,
    telefono:
      evento.payload?.canal_telefono || metadata?.display_phone_number || null,
    etiqueta: evento.payload?.canal_etiqueta || 'WhatsApp',
  };
}

function claveBaseEvento(evento: WhatsappEvento) {
  if (evento.origen === 'instagram') {
    return `instagram:${evento.sender_id || evento.telefono || evento.id}`;
  }

  const telefono = evento.telefono || 'Sin telefono';
  const canal = datosCanalWhatsapp(evento).phoneNumberId || 'principal';
  return `whatsapp:${canal}:${telefono}`;
}

function nombreContacto(evento: WhatsappEvento) {
  if (evento.origen === 'instagram') {
    return evento.sender_id ? `Instagram ${evento.sender_id}` : 'Instagram';
  }

  const { contacto } = valoresPayload(evento);
  return contacto?.profile?.name || 'Cliente WhatsApp';
}

function esMensajePropio(evento: WhatsappEvento) {
  return (
    evento.tipo === 'respuesta' ||
    evento.estado === 'enviado' ||
    evento.payload?.direccion === 'saliente'
  );
}

function textoMensaje(evento: WhatsappEvento) {
  if (evento.origen === 'instagram') {
    return evento.texto || evento.observacion || 'Mensaje recibido desde Instagram.';
  }

  if (esMensajePropio(evento)) {
    return (
      evento.payload?.mensaje ||
      evento.payload?.text?.body ||
      evento.observacion ||
      'Respuesta enviada.'
    );
  }

  const { mensaje } = valoresPayload(evento);

  if (!mensaje) return evento.observacion || 'Mensaje recibido.';
  if (mensaje.type === 'text') return mensaje.text?.body || 'Mensaje de texto.';
  if (mensaje.type === 'order') {
    const cantidad = mensaje.order?.product_items?.length || 0;
    return `Carro de compra recibido con ${cantidad} producto${cantidad === 1 ? '' : 's'}.`;
  }
  if (mensaje.type === 'button') return mensaje.button?.text || 'Respuesta con boton.';
  if (mensaje.type === 'interactive') {
    return (
      mensaje.interactive?.button_reply?.title ||
      mensaje.interactive?.list_reply?.title ||
      'Respuesta interactiva.'
    );
  }
  if (mensaje.type === 'image') return mensaje.image?.caption || 'Imagen recibida.';
  if (mensaje.type === 'audio') return 'Audio recibido.';
  if (mensaje.type === 'document') return mensaje.document?.filename || 'Documento recibido.';
  if (mensaje.type === 'reaction') return `Reaccion: ${mensaje.reaction?.emoji || ''}`;

  return evento.observacion || `Mensaje tipo ${mensaje.type}.`;
}

function fechaChile(valor: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(valor));
}

function horaChile(valor: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(valor));
}

function etiquetaTipo(tipo: string | null) {
  if (tipo === 'respuesta') return 'Tu respuesta';
  if (tipo === 'text') return 'Texto';
  if (tipo === 'order') return 'Pedido';
  if (tipo === 'image') return 'Imagen';
  if (tipo === 'audio') return 'Audio';
  if (tipo === 'document') return 'Documento';
  if (tipo === 'interactive') return 'Interactivo';
  if (tipo === 'button') return 'Boton';
  return tipo || 'Desconocido';
}

function estaPendiente(evento: WhatsappEvento) {
  return (
    evento.tipo !== 'order' &&
    !esMensajePropio(evento) &&
    evento.estado !== 'respondido' &&
    evento.estado !== 'informativo'
  );
}

function esEventoNotificable(evento: WhatsappEvento) {
  return !esMensajePropio(evento) && evento.estado !== 'informativo';
}

export default function AdminWhatsappPage() {
  const [eventos, setEventos] = useState<WhatsappEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [canalActivo, setCanalActivo] = useState<CanalActivo>('whatsapp');
  const [conversacionActivaId, setConversacionActivaId] = useState<string | null>(null);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState<string | null>(null);
  const [cuentaPrincipal, setCuentaPrincipal] = useState<CuentaBancaria | null>(null);
  const [permisoNotificaciones, setPermisoNotificaciones] =
    useState<NotificationPermission | 'no-disponible'>('no-disponible');
  const finalMensajesRef = useRef<HTMLDivElement | null>(null);
  const ultimoEventoNotificadoRef = useRef<string | null>(null);
  const cargaInicialRef = useRef(true);

  function notificarNuevoEvento(evento: WhatsappEvento) {
    const titulo =
      evento.origen === 'instagram'
        ? 'Nuevo mensaje de Instagram'
        : evento.tipo === 'order'
          ? 'Nuevo pedido por WhatsApp'
          : 'Nuevo mensaje de WhatsApp';
    const cuerpo = `${nombreContacto(evento)}: ${textoMensaje(evento)}`;

    toast.info(titulo, {
      description: cuerpo,
      duration: 8000,
    });

    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      const notificacion = new Notification(titulo, {
        body: cuerpo,
        tag: `maruxa-${evento.id}`,
      });
      notificacion.onclick = () => {
        window.focus();
        setConversacionActivaId(claveBaseEvento(evento));
      };
    }
  }

  async function cargarMensajes(silencioso = false) {
    if (!silencioso) setLoading(true);

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      if (!silencioso) setLoading(false);
      return;
    }

    const { data: cuentaData } = await supabase
      .from('cuentas_bancarias')
      .select('banco,tipo_cuenta,numero_cuenta,titular,rut_titular,email_notificacion')
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .eq('es_principal', true)
      .limit(1)
      .maybeSingle();

    setCuentaPrincipal((cuentaData as CuentaBancaria | null) || null);

    const { data, error } = await supabase
      .from('whatsapp_eventos')
      .select('id,created_at,telefono,tipo,estado,observacion,pedido_id,message_id,payload')
      .eq('empresa_id', empresa.id)
      .neq('tipo', 'aviso_administrador')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      alert(error.message);
      if (!silencioso) setLoading(false);
      return;
    }

    const { data: instagramData, error: instagramError } = await supabase
      .from('instagram_eventos')
      .select('id,created_at,sender_id,tipo,estado,observacion,message_id,texto,payload')
      .eq('empresa_id', empresa.id)
      .order('created_at', { ascending: false })
      .limit(1000);

    const eventosWhatsapp = ((data as WhatsappEvento[]) || []).map((evento) => ({
      ...evento,
      origen: 'whatsapp' as const,
    }));
    const eventosInstagram = instagramError
      ? []
      : ((instagramData as WhatsappEvento[]) || []).map((evento) => ({
          ...evento,
          origen: 'instagram' as const,
          telefono: evento.sender_id || 'Instagram',
          pedido_id: null,
        }));

    const eventosOrdenados = [...eventosWhatsapp, ...eventosInstagram].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const ultimoNotificable = eventosOrdenados.find(esEventoNotificable);

    setEventos(eventosOrdenados);

    if (ultimoNotificable) {
      if (cargaInicialRef.current) {
        ultimoEventoNotificadoRef.current = ultimoNotificable.id;
      } else if (ultimoEventoNotificadoRef.current !== ultimoNotificable.id) {
        ultimoEventoNotificadoRef.current = ultimoNotificable.id;
        notificarNuevoEvento(ultimoNotificable);
      }
    }

    cargaInicialRef.current = false;
    if (!silencioso) setLoading(false);
  }

  const eventosVisibles = useMemo(() => {
    if (canalActivo === 'todos') return eventos;
    return eventos.filter((evento) => evento.origen === canalActivo);
  }, [canalActivo, eventos]);

  const conversaciones = useMemo(() => {
    const grupos = new Map<string, WhatsappEvento[]>();
    const canalConocidoPorTelefono = new Map<string, string>();

    eventosVisibles.forEach((evento) => {
      if (evento.origen === 'instagram' || !evento.telefono) return;
      const phoneNumberId = datosCanalWhatsapp(evento).phoneNumberId;
      if (phoneNumberId && !canalConocidoPorTelefono.has(evento.telefono)) {
        canalConocidoPorTelefono.set(evento.telefono, phoneNumberId);
      }
    });

    eventosVisibles.forEach((evento) => {
      const telefono = evento.telefono || 'Sin telefono';
      const clave =
        evento.origen === 'instagram'
          ? `instagram:${evento.sender_id || evento.telefono || evento.id}`
          : `whatsapp:${
              datosCanalWhatsapp(evento).phoneNumberId ||
              canalConocidoPorTelefono.get(telefono) ||
              'principal'
            }:${telefono}`;
      grupos.set(clave, [...(grupos.get(clave) || []), evento]);
    });

    return Array.from(grupos.entries())
      .map(([clave, lista]) => {
        const ordenados = [...lista].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const ultimoEvento = ordenados[ordenados.length - 1];
        const eventoConCanal = [...ordenados]
          .reverse()
          .find((evento) => datosCanalWhatsapp(evento).phoneNumberId);
        const canal = datosCanalWhatsapp(eventoConCanal || ultimoEvento);

        return {
          clave,
          telefono: ultimoEvento.telefono || 'Sin telefono',
          nombre: nombreContacto(ultimoEvento),
          canalPhoneNumberId: canal.phoneNumberId,
          canalTelefono: canal.telefono,
          canalEtiqueta: canal.etiqueta,
          eventos: ordenados,
          pendientes: ordenados.filter(estaPendiente).length,
          ultimoEvento,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.ultimoEvento.created_at).getTime() -
          new Date(a.ultimoEvento.created_at).getTime()
      );
  }, [eventosVisibles]);

  useEffect(() => {
    cargarMensajes();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermisoNotificaciones('no-disponible');
      return;
    }

    setPermisoNotificaciones(Notification.permission);
    const intervalo = window.setInterval(() => {
      cargarMensajes(true);
    }, 30000);
    const canal = supabase
      .channel('mensajes-admin-whatsapp')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_eventos' },
        () => cargarMensajes(true)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'instagram_eventos' },
        () => cargarMensajes(true)
      )
      .subscribe();

    return () => {
      window.clearInterval(intervalo);
      supabase.removeChannel(canal);
    };
  }, []);

  async function activarNotificacionesWeb() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Este navegador no permite notificaciones.');
      return;
    }

    const permiso = await Notification.requestPermission();
    setPermisoNotificaciones(permiso);

    if (permiso === 'granted') {
      toast.success('Avisos web activados.');
    } else {
      toast.error('No se activaron los avisos web.');
    }
  }

  useEffect(() => {
    const conversacionValida = conversaciones.some(
      (conversacion) => conversacion.clave === conversacionActivaId
    );

    if (conversaciones.length === 0) {
      setConversacionActivaId(null);
      return;
    }

    if (!conversacionActivaId || !conversacionValida) {
      setConversacionActivaId(conversaciones[0].clave);
    }
  }, [conversaciones, conversacionActivaId]);

  const conversacionesFiltradas = conversaciones.filter((conversacion) => {
    const texto = `${conversacion.nombre} ${conversacion.telefono} ${conversacion.canalTelefono || ''} ${textoMensaje(
      conversacion.ultimoEvento
    )}`.toLowerCase();

    return texto.includes(busqueda.toLowerCase().trim());
  });

  const conversacionActiva =
    conversaciones.find((conversacion) => conversacion.clave === conversacionActivaId) ||
    conversacionesFiltradas[0] ||
    null;

  useEffect(() => {
    finalMensajesRef.current?.scrollIntoView({ block: 'end' });
  }, [conversacionActiva?.clave, conversacionActiva?.eventos.length]);

  const resumen = {
    conversaciones: conversaciones.length,
    mensajes: eventosVisibles.filter((evento) => evento.tipo !== 'order').length,
    pedidos: eventosVisibles.filter((evento) => evento.tipo === 'order').length,
    pendientes: eventosVisibles.filter(estaPendiente).length,
  };

  const eventosRecientes = [...eventosVisibles]
    .filter((evento) => evento.tipo !== 'order')
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 8);

  const canales = [
    {
      id: 'whatsapp' as const,
      label: 'WhatsApp',
      detalle: 'Numero conectado',
      total: eventos.filter((evento) => evento.origen === 'whatsapp').length,
    },
    {
      id: 'instagram' as const,
      label: 'Instagram',
      detalle: 'Solo lectura',
      total: eventos.filter((evento) => evento.origen === 'instagram').length,
    },
    {
      id: 'todos' as const,
      label: 'Todo',
      detalle: 'Vista unificada',
      total: eventos.length,
    },
  ];
  const canalActual = canales.find((canal) => canal.id === canalActivo);

  async function enviarRespuesta(
    conversacion: Conversacion,
    mensajeRapido?: string
  ) {
    const mensaje = mensajeRapido?.trim() || respuestas[conversacion.clave]?.trim();

    if (!mensaje) {
      alert('Escribe una respuesta.');
      return;
    }

    if (conversacion.ultimoEvento.origen === 'instagram') {
      alert('La respuesta a Instagram requiere configurar el envio por Instagram Messaging. Por ahora este chat recibe y muestra mensajes.');
      return;
    }

    if (conversacion.telefono === 'Sin telefono') {
      alert('Esta conversacion no tiene telefono asociado.');
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      alert('Tu sesion expiro. Vuelve a iniciar sesion.');
      return;
    }

    setEnviando(conversacion.clave);

    const idsPendientes = conversacion.eventos
      .filter(estaPendiente)
      .map((evento) => evento.id);

    const respuesta = await fetch('/api/whatsapp/enviar-mensaje', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telefono: conversacion.telefono,
        mensaje,
        idsPendientes,
        phoneNumberId: conversacion.canalPhoneNumberId,
      }),
    });

    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setEnviando(null);
      alert(data.error || 'No se pudo enviar la respuesta.');
      return;
    }

    setRespuestas((actual) => ({ ...actual, [conversacion.clave]: '' }));
    setEnviando(null);
    cargarMensajes();
  }

  return (
    <main className="min-h-screen bg-maruxa-crema px-3 py-4 md:px-5 md:py-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.22em] text-maruxa-rojo">
              Inbox conectado
            </p>

            <h1 className="mt-1 text-2xl font-black text-maruxa-chocolate md:text-3xl">
              WhatsApp Business
            </h1>

            <p className="mt-1 max-w-2xl text-xs font-bold text-maruxa-cafe/70">
              Bandeja para ver y responder los mensajes que llegan por el numero conectado a Meta.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {permisoNotificaciones === 'default' && (
              <button
                type="button"
                onClick={activarNotificacionesWeb}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#A51F2B] px-4 text-xs font-black text-white shadow-premium"
              >
                Activar avisos web
              </button>
            )}

            <button
              type="button"
              onClick={() => cargarMensajes()}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-black text-maruxa-chocolate shadow-premium"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {canales.map((canal) => {
            const activo = canalActivo === canal.id;

            return (
              <button
                key={canal.id}
                type="button"
                onClick={() => setCanalActivo(canal.id)}
                className={`rounded-xl px-4 py-3 text-left shadow-premium transition ${
                  activo
                    ? 'bg-[#A51F2B] text-white'
                    : 'bg-white text-maruxa-chocolate hover:bg-maruxa-crema'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black">{canal.label}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      activo ? 'bg-white/15 text-white' : 'bg-maruxa-crema text-maruxa-rojo'
                    }`}
                  >
                    {canal.total}
                  </span>
                </div>
                <p className={`mt-1 text-[11px] font-bold ${activo ? 'text-white/70' : 'text-maruxa-cafe/60'}`}>
                  {canal.detalle}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {[
            ['Conversaciones', resumen.conversaciones, 'text-maruxa-chocolate'],
            ['Mensajes', resumen.mensajes, 'text-maruxa-vino'],
            ['Pedidos', resumen.pedidos, 'text-maruxa-rojo'],
            ['Pendientes', resumen.pendientes, 'text-amber-700'],
          ].map(([label, valor, color]) => (
            <div key={label} className="rounded-xl bg-white px-3 py-2 shadow-premium">
              <p className="text-[10px] font-black uppercase tracking-widest text-maruxa-cafe/60">
                {label}
              </p>
              <p className={`text-xl font-black ${color}`}>{valor}</p>
            </div>
          ))}
        </div>

        <section className="mt-3 rounded-xl bg-white p-2 shadow-premium">
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-maruxa-cafe/60">
              Ultimos mensajes
            </p>
            <p className="text-[10px] font-bold text-maruxa-cafe/50">
              {canalActual?.label || 'Vista unificada'}
            </p>
          </div>

          <div className="mt-2 max-h-24 overflow-y-auto">
            {eventosRecientes.length === 0 ? (
              <p className="rounded-lg bg-maruxa-crema px-3 py-2 text-xs font-bold text-maruxa-cafe/70">
                No hay mensajes recientes en esta vista.
              </p>
            ) : (
              eventosRecientes.map((evento) => (
                <button
                  key={evento.id}
                  type="button"
                  onClick={() => {
                    const conversacion = conversaciones.find((item) =>
                      item.eventos.some((eventoConversacion) => eventoConversacion.id === evento.id)
                    );
                    setConversacionActivaId(conversacion?.clave || claveBaseEvento(evento));
                  }}
                  className="mb-1 grid w-full grid-cols-[52px_minmax(0,1fr)] items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-bold text-maruxa-chocolate hover:bg-maruxa-crema sm:grid-cols-[82px_minmax(0,1fr)_auto] sm:px-3"
                >
                  <span className="text-[10px] font-black text-maruxa-cafe/55">
                    {horaChile(evento.created_at)}
                  </span>
                  <span className="truncate">{textoMensaje(evento)}</span>
                  <span className="col-span-2 truncate text-[10px] font-black text-maruxa-rojo sm:col-span-1">
                    {evento.origen === 'instagram' ? 'Instagram' : evento.telefono || 'Sin telefono'}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-xl bg-white shadow-premium">
          <div className="grid min-h-0 lg:h-[460px] lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="border-b border-maruxa-rojo/10 bg-white lg:border-b-0 lg:border-r">
              <div className="border-b border-maruxa-rojo/10 p-2">
                <label className="relative block">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-maruxa-cafe/40" />
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder={`Buscar en ${canalActual?.label || 'chats'}`}
                    className="h-9 w-full rounded-lg border border-maruxa-rojo/10 bg-maruxa-crema pl-9 pr-3 text-xs font-bold text-maruxa-chocolate outline-none"
                  />
                </label>
              </div>

              <div className="h-48 overflow-y-auto p-1.5 lg:h-[410px]">
                {loading ? (
                  <p className="p-5 font-black text-maruxa-chocolate">
                    Cargando mensajes...
                  </p>
                ) : conversacionesFiltradas.length === 0 ? (
                  <p className="p-5 text-sm font-bold text-maruxa-cafe/70">
                    No hay conversaciones para mostrar.
                  </p>
                ) : (
                  conversacionesFiltradas.map((conversacion) => {
                    const activo = conversacion.clave === conversacionActiva?.clave;
                    const esPedido = conversacion.ultimoEvento.tipo === 'order';
                    const esInstagram = conversacion.ultimoEvento.origen === 'instagram';

                    return (
                      <button
                        key={conversacion.clave}
                        type="button"
                        onClick={() => setConversacionActivaId(conversacion.clave)}
                        className={`mb-1 grid w-full grid-cols-[32px_minmax(0,1fr)_auto] gap-2 rounded-lg p-2 text-left transition ${
                          activo
                            ? 'bg-[#A51F2B] text-white'
                            : 'bg-white text-maruxa-chocolate hover:bg-maruxa-crema'
                        }`}
                      >
                        <div
                          className={`grid h-8 w-8 place-items-center rounded-full ${
                            activo
                              ? 'bg-white/15'
                              : esInstagram
                                ? 'bg-pink-50 text-pink-700'
                                : esPedido
                                ? 'bg-maruxa-rojo text-white'
                                : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {esPedido ? (
                            <ShoppingBag className="h-3.5 w-3.5" />
                          ) : (
                            <MessageCircle className="h-3.5 w-3.5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-xs font-black">{conversacion.nombre}</p>
                          <p
                            className={`truncate text-[11px] font-bold ${
                              activo ? 'text-white/75' : 'text-maruxa-cafe/60'
                            }`}
                          >
                            {textoMensaje(conversacion.ultimoEvento)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p
                            className={`text-[9px] font-black ${
                              activo ? 'text-white/70' : 'text-maruxa-cafe/50'
                            }`}
                          >
                            {horaChile(conversacion.ultimoEvento.created_at)}
                          </p>
                          {conversacion.pendientes > 0 && (
                            <span className="mt-1 inline-grid min-h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-[#2A1710]">
                              {conversacion.pendientes}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            <section className="flex h-[460px] min-h-0 min-w-0 flex-col bg-[#F6EADC] lg:h-auto">
              {conversacionActiva ? (
                <>
                  <header className="flex items-center justify-between gap-3 border-b border-maruxa-rojo/10 bg-white px-4 py-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-black text-maruxa-chocolate">
                        {conversacionActiva.nombre}
                      </h2>
                      <p className="text-xs font-bold text-maruxa-cafe/65">
                        {conversacionActiva.ultimoEvento.origen === 'instagram'
                          ? 'Instagram'
                          : conversacionActiva.telefono}
                      </p>
                      {conversacionActiva.ultimoEvento.origen !== 'instagram' && (
                        <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-maruxa-rojo">
                          Recibido en {conversacionActiva.canalTelefono || conversacionActiva.canalEtiqueta}
                        </p>
                      )}
                    </div>

                    {conversacionActiva.pendientes > 0 ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1.5 text-[10px] font-black uppercase text-amber-800">
                        {conversacionActiva.pendientes} pendiente
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-[10px] font-black uppercase text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Al dia
                      </span>
                    )}
                  </header>

                  <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    <div className="flex min-h-full flex-col justify-end gap-2">
                    {conversacionActiva.eventos.map((evento) => {
                      const esPedido = evento.tipo === 'order';
                      const esInstagram = evento.origen === 'instagram';
                      const propio = esMensajePropio(evento);
                      const pendiente = estaPendiente(evento);

                      return (
                        <div
                          key={evento.id}
                          className={`flex ${propio ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[min(620px,92%)] rounded-xl px-3 py-2 shadow-sm ${
                              propio
                                ? 'bg-[#A51F2B] text-white'
                                : esInstagram
                                ? 'bg-pink-50 text-maruxa-chocolate'
                                : esPedido
                                ? 'bg-[#A51F2B] text-white'
                                : pendiente
                                  ? 'bg-white text-maruxa-chocolate'
                                  : 'bg-emerald-50 text-maruxa-chocolate'
                            }`}
                          >
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                                  propio || esPedido
                                    ? 'bg-white/15 text-white'
                                    : esInstagram
                                      ? 'bg-pink-100 text-pink-700'
                                    : 'bg-maruxa-crema text-maruxa-cafe'
                                }`}
                              >
                                {propio
                                  ? 'Tu respuesta'
                                  : evento.origen === 'instagram'
                                    ? `Instagram - ${etiquetaTipo(evento.tipo)}`
                                    : etiquetaTipo(evento.tipo)}
                              </span>
                              {evento.estado === 'respondido' && !propio && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700">
                                  Respondido
                                </span>
                              )}
                            </div>

                            <p className="break-words text-xs font-bold leading-5">
                              {textoMensaje(evento)}
                            </p>

                            {evento.observacion && evento.observacion !== textoMensaje(evento) && (
                              <p
                                className={`mt-1.5 break-words rounded-lg p-2 text-[11px] font-bold ${
                                  propio || esPedido
                                    ? 'bg-white/10 text-white/85'
                                    : 'bg-amber-50 text-amber-800'
                                }`}
                              >
                                {evento.observacion}
                              </p>
                            )}

                            {evento.pedido_id && (
                              <a
                                href="/admin/pedidos"
                                className="mt-2 inline-flex rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#A51F2B]"
                              >
                                Ver pedido #{evento.pedido_id}
                              </a>
                            )}

                            <p
                              className={`mt-1.5 flex items-center gap-1 text-[10px] font-black ${
                                propio || esPedido ? 'text-white/70' : 'text-maruxa-cafe/50'
                              }`}
                            >
                              <Clock className="h-3 w-3" />
                              {fechaChile(evento.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                      <div ref={finalMensajesRef} />
                    </div>
                  </div>

                  <footer className="border-t border-maruxa-rojo/10 bg-white p-3">
                    {conversacionActiva.ultimoEvento.origen !== 'instagram' && (
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-maruxa-cafe/55">
                          Respuestas rapidas
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            cuentaPrincipal &&
                            enviarRespuesta(
                              conversacionActiva,
                              textoCuentaBancaria(cuentaPrincipal)
                            )
                          }
                          disabled={
                            !cuentaPrincipal || enviando === conversacionActiva.clave
                          }
                          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-800 transition hover:bg-emerald-100 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500"
                          title={
                            cuentaPrincipal
                              ? 'Enviar la cuenta bancaria principal'
                              : 'Configura una cuenta principal en Empresa'
                          }
                        >
                          <Landmark className="h-3.5 w-3.5" />
                          {cuentaPrincipal
                            ? 'Enviar cuenta bancaria'
                            : 'Falta cuenta principal'}
                        </button>
                      </div>
                    )}
                    <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_150px] lg:items-end">
                      <textarea
                        value={respuestas[conversacionActiva.clave] || ''}
                        onChange={(e) =>
                          setRespuestas((actual) => ({
                            ...actual,
                            [conversacionActiva.clave]: e.target.value,
                          }))
                        }
                        placeholder="Escribe un mensaje"
                        disabled={conversacionActiva.ultimoEvento.origen === 'instagram'}
                        className="min-h-10 w-full min-w-0 resize-y rounded-lg border border-maruxa-rojo/10 bg-maruxa-crema p-2.5 text-xs font-bold leading-5 text-maruxa-chocolate outline-none"
                      />

                      <button
                        type="button"
                        onClick={() => enviarRespuesta(conversacionActiva)}
                        disabled={
                          enviando === conversacionActiva.clave ||
                          conversacionActiva.ultimoEvento.origen === 'instagram'
                        }
                        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border-2 border-[#7A111B] bg-[#A51F2B] px-4 py-2 text-center text-xs font-black leading-5 text-white shadow-[0_10px_24px_rgba(165,31,43,0.28)] transition hover:bg-[#7A111B] disabled:border-zinc-300 disabled:bg-zinc-300 disabled:text-zinc-600 disabled:shadow-none"
                      >
                        <Send className="h-4 w-4 shrink-0" />
                        {conversacionActiva.ultimoEvento.origen === 'instagram'
                          ? 'Solo lectura'
                          : enviando === conversacionActiva.clave
                          ? 'Enviando...'
                          : 'Enviar'}
                      </button>
                    </div>
                  </footer>
                </>
              ) : (
                <div className="grid flex-1 place-items-center p-8 text-center">
                  <div>
                    <MessageCircle className="mx-auto h-12 w-12 text-maruxa-rojo" />
                    <p className="mt-4 text-2xl font-black text-maruxa-chocolate">
                      No hay conversaciones.
                    </p>
                    <p className="mt-2 font-bold text-maruxa-cafe/70">
                      Cuando llegue un mensaje al WhatsApp conectado aparecera aqui.
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
