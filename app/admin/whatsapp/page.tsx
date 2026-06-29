'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
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
  created_at: string;
  telefono: string | null;
  tipo: string | null;
  estado: string | null;
  observacion: string | null;
  pedido_id: number | null;
  message_id: string | null;
  payload: any;
};

type Conversacion = {
  telefono: string;
  nombre: string;
  eventos: WhatsappEvento[];
  pendientes: number;
  ultimoEvento: WhatsappEvento;
};

function valoresPayload(evento: WhatsappEvento) {
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

function nombreContacto(evento: WhatsappEvento) {
  const { contacto } = valoresPayload(evento);
  return contacto?.profile?.name || 'Cliente WhatsApp';
}

function textoMensaje(evento: WhatsappEvento) {
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
  return evento.tipo !== 'order' && evento.estado !== 'respondido';
}

export default function AdminWhatsappPage() {
  const [eventos, setEventos] = useState<WhatsappEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [telefonoActivo, setTelefonoActivo] = useState<string | null>(null);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState<string | null>(null);

  async function cargarMensajes() {
    setLoading(true);

    const empresa = await obtenerEmpresaActual();

    if (!empresa) {
      alert('No se pudo identificar la empresa.');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('whatsapp_eventos')
      .select('id,created_at,telefono,tipo,estado,observacion,pedido_id,message_id,payload')
      .eq('empresa_id', empresa.id)
      .order('created_at', { ascending: false })
      .limit(250);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setEventos((data as WhatsappEvento[]) || []);
    setLoading(false);
  }

  const conversaciones = useMemo(() => {
    const grupos = new Map<string, WhatsappEvento[]>();

    eventos.forEach((evento) => {
      const telefono = evento.telefono || 'Sin telefono';
      grupos.set(telefono, [...(grupos.get(telefono) || []), evento]);
    });

    return Array.from(grupos.entries())
      .map(([telefono, lista]) => {
        const ordenados = [...lista].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const ultimoEvento = ordenados[ordenados.length - 1];

        return {
          telefono,
          nombre: nombreContacto(ultimoEvento),
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
  }, [eventos]);

  useEffect(() => {
    cargarMensajes();
  }, []);

  useEffect(() => {
    if (!telefonoActivo && conversaciones.length > 0) {
      setTelefonoActivo(conversaciones[0].telefono);
    }
  }, [conversaciones, telefonoActivo]);

  const conversacionesFiltradas = conversaciones.filter((conversacion) => {
    const texto = `${conversacion.nombre} ${conversacion.telefono} ${textoMensaje(
      conversacion.ultimoEvento
    )}`.toLowerCase();

    return texto.includes(busqueda.toLowerCase().trim());
  });

  const conversacionActiva =
    conversaciones.find((conversacion) => conversacion.telefono === telefonoActivo) ||
    conversacionesFiltradas[0] ||
    null;

  const resumen = {
    conversaciones: conversaciones.length,
    mensajes: eventos.filter((evento) => evento.tipo !== 'order').length,
    pedidos: eventos.filter((evento) => evento.tipo === 'order').length,
    pendientes: eventos.filter(estaPendiente).length,
  };

  async function enviarRespuesta(conversacion: Conversacion) {
    const mensaje = respuestas[conversacion.telefono]?.trim();

    if (!mensaje) {
      alert('Escribe una respuesta.');
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

    setEnviando(conversacion.telefono);

    const respuesta = await fetch('/api/whatsapp/enviar-mensaje', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telefono: conversacion.telefono,
        mensaje,
      }),
    });

    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setEnviando(null);
      alert(data.error || 'No se pudo enviar la respuesta.');
      return;
    }

    const idsPendientes = conversacion.eventos
      .filter(estaPendiente)
      .map((evento) => evento.id);

    if (idsPendientes.length > 0) {
      await supabase
        .from('whatsapp_eventos')
        .update({
          estado: 'respondido',
          observacion: 'Respuesta enviada desde la bandeja WhatsApp.',
        })
        .in('id', idsPendientes);
    }

    setRespuestas((actual) => ({ ...actual, [conversacion.telefono]: '' }));
    setEnviando(null);
    cargarMensajes();
  }

  return (
    <main className="min-h-screen bg-maruxa-crema px-3 py-5 md:px-5 md:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.22em] text-maruxa-rojo">
              WhatsApp Business
            </p>

            <h1 className="mt-2 text-3xl font-black text-maruxa-chocolate md:text-4xl">
              Chat WhatsApp
            </h1>

            <p className="mt-2 max-w-2xl text-sm font-bold text-maruxa-cafe/70">
              Conversaciones agrupadas por cliente para atender mensajes y pedidos.
            </p>
          </div>

          <button
            type="button"
            onClick={cargarMensajes}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-black text-maruxa-chocolate shadow-premium"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            ['Conversaciones', resumen.conversaciones, 'text-maruxa-chocolate'],
            ['Mensajes', resumen.mensajes, 'text-maruxa-vino'],
            ['Pedidos', resumen.pedidos, 'text-maruxa-rojo'],
            ['Pendientes', resumen.pendientes, 'text-amber-700'],
          ].map(([label, valor, color]) => (
            <div key={label} className="rounded-2xl bg-white p-3 shadow-premium">
              <p className="text-[10px] font-black uppercase tracking-widest text-maruxa-cafe/60">
                {label}
              </p>
              <p className={`mt-1 text-2xl font-black ${color}`}>{valor}</p>
            </div>
          ))}
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl bg-white shadow-premium">
          <div className="grid min-h-[560px] lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="border-b border-maruxa-rojo/10 bg-white lg:border-b-0 lg:border-r">
              <div className="border-b border-maruxa-rojo/10 p-3">
                <label className="relative block">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-maruxa-cafe/40" />
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar chat"
                    className="h-10 w-full rounded-xl border border-maruxa-rojo/10 bg-maruxa-crema pl-11 pr-4 text-sm font-bold text-maruxa-chocolate outline-none"
                  />
                </label>
              </div>

              <div className="max-h-[500px] overflow-y-auto p-2">
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
                    const activo = conversacion.telefono === conversacionActiva?.telefono;
                    const esPedido = conversacion.ultimoEvento.tipo === 'order';

                    return (
                      <button
                        key={conversacion.telefono}
                        type="button"
                        onClick={() => setTelefonoActivo(conversacion.telefono)}
                        className={`mb-1 grid w-full grid-cols-[38px_minmax(0,1fr)_auto] gap-2 rounded-xl p-2.5 text-left transition ${
                          activo
                            ? 'bg-[#A51F2B] text-white'
                            : 'bg-white text-maruxa-chocolate hover:bg-maruxa-crema'
                        }`}
                      >
                        <div
                          className={`grid h-9 w-9 place-items-center rounded-full ${
                            activo
                              ? 'bg-white/15'
                              : esPedido
                                ? 'bg-maruxa-rojo text-white'
                                : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {esPedido ? (
                            <ShoppingBag className="h-4 w-4" />
                          ) : (
                            <MessageCircle className="h-4 w-4" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">{conversacion.nombre}</p>
                          <p
                            className={`truncate text-xs font-bold ${
                              activo ? 'text-white/75' : 'text-maruxa-cafe/60'
                            }`}
                          >
                            {textoMensaje(conversacion.ultimoEvento)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p
                            className={`text-[10px] font-black ${
                              activo ? 'text-white/70' : 'text-maruxa-cafe/50'
                            }`}
                          >
                            {horaChile(conversacion.ultimoEvento.created_at)}
                          </p>
                          {conversacion.pendientes > 0 && (
                            <span className="mt-1 inline-grid min-h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-[#2A1710]">
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

            <section className="flex min-w-0 flex-col bg-[#F6EADC]">
              {conversacionActiva ? (
                <>
                  <header className="flex items-center justify-between gap-4 border-b border-maruxa-rojo/10 bg-white px-5 py-4">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-black text-maruxa-chocolate">
                        {conversacionActiva.nombre}
                      </h2>
                      <p className="text-sm font-bold text-maruxa-cafe/65">
                        {conversacionActiva.telefono}
                      </p>
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

                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {conversacionActiva.eventos.map((evento) => {
                      const esPedido = evento.tipo === 'order';
                      const pendiente = estaPendiente(evento);

                      return (
                        <div key={evento.id} className="flex justify-start">
                          <div
                            className={`max-w-[min(680px,92%)] rounded-2xl px-4 py-3 shadow-sm ${
                              esPedido
                                ? 'bg-[#A51F2B] text-white'
                                : pendiente
                                  ? 'bg-white text-maruxa-chocolate'
                                  : 'bg-emerald-50 text-maruxa-chocolate'
                            }`}
                          >
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                                  esPedido
                                    ? 'bg-white/15 text-white'
                                    : 'bg-maruxa-crema text-maruxa-cafe'
                                }`}
                              >
                                {etiquetaTipo(evento.tipo)}
                              </span>
                              {evento.estado === 'respondido' && (
                                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase text-emerald-700">
                                  Respondido
                                </span>
                              )}
                            </div>

                            <p className="break-words text-sm font-bold leading-6">
                              {textoMensaje(evento)}
                            </p>

                            {evento.observacion && (
                              <p
                                className={`mt-2 break-words rounded-xl p-3 text-xs font-bold ${
                                  esPedido
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
                                className="mt-2 inline-flex rounded-full bg-white px-4 py-2 text-xs font-black text-[#A51F2B]"
                              >
                                Ver pedido #{evento.pedido_id}
                              </a>
                            )}

                            <p
                              className={`mt-2 flex items-center gap-1 text-[11px] font-black ${
                                esPedido ? 'text-white/70' : 'text-maruxa-cafe/50'
                              }`}
                            >
                              <Clock className="h-3.5 w-3.5" />
                              {fechaChile(evento.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <footer className="border-t border-maruxa-rojo/10 bg-white p-4">
                    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-end">
                      <textarea
                        value={respuestas[conversacionActiva.telefono] || ''}
                        onChange={(e) =>
                          setRespuestas((actual) => ({
                            ...actual,
                            [conversacionActiva.telefono]: e.target.value,
                          }))
                        }
                        placeholder="Escribe un mensaje"
                        className="min-h-12 w-full min-w-0 resize-y rounded-xl border border-maruxa-rojo/10 bg-maruxa-crema p-3 text-sm font-bold leading-5 text-maruxa-chocolate outline-none"
                      />

                      <button
                        type="button"
                        onClick={() => enviarRespuesta(conversacionActiva)}
                        disabled={enviando === conversacionActiva.telefono}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border-2 border-[#7A111B] bg-[#A51F2B] px-4 py-2.5 text-center text-sm font-black leading-5 text-white shadow-[0_10px_24px_rgba(165,31,43,0.28)] transition hover:bg-[#7A111B] disabled:border-zinc-300 disabled:bg-zinc-300 disabled:text-zinc-600 disabled:shadow-none"
                      >
                        <Send className="h-4 w-4 shrink-0" />
                        {enviando === conversacionActiva.telefono
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
