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

export default function AdminWhatsappPage() {
  const [eventos, setEventos] = useState<WhatsappEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
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
      .limit(150);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setEventos((data as WhatsappEvento[]) || []);
    setLoading(false);
  }

  async function enviarRespuesta(evento: WhatsappEvento) {
    const mensaje = respuestas[evento.id]?.trim();

    if (!mensaje) {
      alert('Escribe una respuesta.');
      return;
    }

    if (!evento.telefono) {
      alert('Este mensaje no tiene telefono asociado.');
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      alert('Tu sesion expiro. Vuelve a iniciar sesion.');
      return;
    }

    setEnviando(evento.id);

    const respuesta = await fetch('/api/whatsapp/enviar-mensaje', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telefono: evento.telefono,
        mensaje,
      }),
    });

    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setEnviando(null);
      alert(data.error || 'No se pudo enviar la respuesta.');
      return;
    }

    await supabase
      .from('whatsapp_eventos')
      .update({
        estado: 'respondido',
        observacion: 'Respuesta enviada desde la bandeja WhatsApp.',
      })
      .eq('id', evento.id);

    setRespuestas((actual) => ({ ...actual, [evento.id]: '' }));
    setEnviando(null);
    cargarMensajes();
  }

  useEffect(() => {
    cargarMensajes();
  }, []);

  const resumen = useMemo(
    () => ({
      total: eventos.length,
      mensajes: eventos.filter((evento) => evento.tipo !== 'order').length,
      pedidos: eventos.filter((evento) => evento.tipo === 'order').length,
      respondidos: eventos.filter((evento) => evento.estado === 'respondido').length,
    }),
    [eventos]
  );

  const eventosFiltrados = eventos.filter((evento) => {
    const texto = `${nombreContacto(evento)} ${evento.telefono || ''} ${textoMensaje(
      evento
    )} ${evento.estado || ''}`.toLowerCase();
    const coincideBusqueda = texto.includes(busqueda.toLowerCase().trim());
    const coincideTipo = filtroTipo === 'todos' || evento.tipo === filtroTipo;

    return coincideBusqueda && coincideTipo;
  });

  return (
    <main className="min-h-screen bg-maruxa-crema px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-black uppercase tracking-[.24em] text-maruxa-rojo">
              WhatsApp Business
            </p>

            <h1 className="mt-3 text-5xl font-black text-maruxa-chocolate">
              Mensajes WhatsApp
            </h1>

            <p className="mt-3 max-w-2xl font-bold text-maruxa-cafe/70">
              Bandeja de mensajes y pedidos recibidos desde el webhook de Meta.
            </p>
          </div>

          <button
            type="button"
            onClick={cargarMensajes}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 font-black text-maruxa-chocolate shadow-premium"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-[24px] bg-white p-5 shadow-premium">
            <p className="text-xs font-black uppercase tracking-widest text-maruxa-cafe/60">
              Eventos
            </p>
            <p className="mt-2 text-3xl font-black text-maruxa-chocolate">
              {resumen.total}
            </p>
          </div>

          <div className="rounded-[24px] bg-white p-5 shadow-premium">
            <p className="text-xs font-black uppercase tracking-widest text-maruxa-cafe/60">
              Mensajes
            </p>
            <p className="mt-2 text-3xl font-black text-maruxa-vino">
              {resumen.mensajes}
            </p>
          </div>

          <div className="rounded-[24px] bg-white p-5 shadow-premium">
            <p className="text-xs font-black uppercase tracking-widest text-maruxa-cafe/60">
              Pedidos
            </p>
            <p className="mt-2 text-3xl font-black text-maruxa-rojo">
              {resumen.pedidos}
            </p>
          </div>

          <div className="rounded-[24px] bg-white p-5 shadow-premium">
            <p className="text-xs font-black uppercase tracking-widest text-maruxa-cafe/60">
              Respondidos
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-700">
              {resumen.respondidos}
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-[28px] bg-white p-5 shadow-premium">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <label className="relative block">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-maruxa-cafe/40" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, telefono, texto o estado"
                className="h-12 w-full rounded-2xl border border-maruxa-rojo/10 bg-maruxa-crema pl-12 pr-4 font-bold text-maruxa-chocolate outline-none"
              />
            </label>

            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="h-12 rounded-2xl border border-maruxa-rojo/10 bg-maruxa-crema px-4 font-bold text-maruxa-chocolate outline-none"
            >
              <option value="todos">Todos los tipos</option>
              <option value="text">Texto</option>
              <option value="order">Pedidos</option>
              <option value="image">Imagenes</option>
              <option value="audio">Audios</option>
              <option value="document">Documentos</option>
              <option value="interactive">Interactivos</option>
            </select>
          </div>
        </section>

        <section className="mt-6 grid gap-4">
          {loading ? (
            <div className="rounded-[28px] bg-white p-8 font-black text-maruxa-chocolate shadow-premium">
              Cargando mensajes...
            </div>
          ) : eventosFiltrados.length === 0 ? (
            <div className="rounded-[28px] bg-white p-8 text-center shadow-premium">
              <MessageCircle className="mx-auto h-10 w-10 text-maruxa-rojo" />
              <p className="mt-4 text-xl font-black text-maruxa-chocolate">
                No hay mensajes para mostrar.
              </p>
              <p className="mt-2 font-bold text-maruxa-cafe/70">
                Cuando un cliente escriba al WhatsApp conectado, aparecera aqui.
              </p>
            </div>
          ) : (
            eventosFiltrados.map((evento) => {
              const esPedido = evento.tipo === 'order';

              return (
                <article
                  key={evento.id}
                  className="overflow-hidden rounded-[28px] bg-white shadow-premium"
                >
                  <div className="flex flex-col gap-4 border-b border-maruxa-rojo/10 bg-white p-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-4">
                      <div
                        className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
                          esPedido
                            ? 'bg-maruxa-rojo text-white'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {esPedido ? (
                          <ShoppingBag className="h-6 w-6" />
                        ) : (
                          <MessageCircle className="h-6 w-6" />
                        )}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-black text-maruxa-chocolate">
                            {nombreContacto(evento)}
                          </h2>
                          <span className="rounded-full bg-maruxa-crema px-3 py-1 text-xs font-black uppercase text-maruxa-cafe">
                            {etiquetaTipo(evento.tipo)}
                          </span>
                          {evento.estado === 'respondido' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Respondido
                            </span>
                          )}
                        </div>

                        <p className="mt-1 font-bold text-maruxa-cafe/70">
                          {evento.telefono || 'Sin telefono'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-black text-maruxa-cafe/60">
                      <Clock className="h-4 w-4" />
                      {fechaChile(evento.created_at)}
                    </div>
                  </div>

                  <div className="grid min-w-0 gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.45fr)]">
                    <div className="min-w-0">
                      <p className="overflow-hidden break-words rounded-2xl bg-maruxa-crema p-5 text-lg font-bold leading-8 text-maruxa-chocolate">
                        {textoMensaje(evento)}
                      </p>

                      {evento.observacion && (
                        <p className="mt-3 overflow-hidden break-words rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
                          {evento.observacion}
                        </p>
                      )}

                      {evento.pedido_id && (
                        <a
                          href="/admin/pedidos"
                          className="mt-3 inline-flex rounded-full bg-maruxa-rojo px-5 py-3 text-sm font-black text-white"
                        >
                          Ver pedido #{evento.pedido_id}
                        </a>
                      )}
                    </div>

                    <div className="min-w-0 rounded-2xl border border-maruxa-rojo/10 bg-maruxa-crema p-4">
                      <label className="text-xs font-black uppercase tracking-wide text-maruxa-cafe/60">
                        Responder por WhatsApp
                      </label>
                      <textarea
                        value={respuestas[evento.id] || ''}
                        onChange={(e) =>
                          setRespuestas((actual) => ({
                            ...actual,
                            [evento.id]: e.target.value,
                          }))
                        }
                        placeholder="Escribe la respuesta al cliente"
                        className="mt-3 min-h-32 w-full resize-y rounded-2xl border border-maruxa-rojo/10 bg-white p-4 font-bold leading-6 text-maruxa-chocolate outline-none"
                      />

                      <button
                        type="button"
                        onClick={() => enviarRespuesta(evento)}
                        disabled={enviando === evento.id}
                        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-maruxa-rojo px-5 py-3 text-center font-black leading-5 text-white disabled:opacity-60"
                      >
                        <Send className="h-4 w-4 shrink-0" />
                        {enviando === evento.id ? 'Enviando...' : 'Enviar respuesta'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
