'use client';

import { useState } from 'react';
import { supabasePublic } from '@/lib/supabase-public';
import { whatsapp } from '@/lib/datos';

export function FormularioTortas() {
  const [enviando, setEnviando] = useState(false);

  async function enviarPedido(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);

    const form = new FormData(e.currentTarget);

    const pedido = {
      cliente: String(form.get('cliente') || ''),
      telefono: String(form.get('telefono') || ''),
      sabor: String(form.get('sabor') || ''),
      tamano: String(form.get('tamano') || ''),
      dedicatoria: String(form.get('dedicatoria') || ''),
      fecha_retiro: String(form.get('fecha_retiro') || ''),
      hora_retiro: String(form.get('hora_retiro') || ''),
      observaciones: String(form.get('observaciones') || ''),
      estado: 'pendiente',
    };

    const { error } = await supabasePublic.from('tortas').insert([pedido]);

    if (error) {
      alert('No se pudo guardar el pedido. Revisa Supabase.');
      setEnviando(false);
      return;
    }

    const mensaje = encodeURIComponent(
      `Hola Maruxa, quiero pedir una torta.%0A%0A` +
      `Nombre: ${pedido.cliente}%0A` +
      `Teléfono: ${pedido.telefono}%0A` +
      `Sabor: ${pedido.sabor}%0A` +
      `Tamaño: ${pedido.tamano}%0A` +
      `Dedicatoria: ${pedido.dedicatoria}%0A` +
      `Fecha retiro: ${pedido.fecha_retiro}%0A` +
      `Hora retiro: ${pedido.hora_retiro}%0A` +
      `Observaciones: ${pedido.observaciones}`
    );

    window.open(`https://wa.me/${whatsapp}?text=${mensaje}`, '_blank');
    e.currentTarget.reset();
    setEnviando(false);
  }

  return (
    <form
      onSubmit={enviarPedido}
      className="card-premium rounded-[34px] bg-white/10 p-6"
    >
      <input name="cliente" required placeholder="Nombre" className="mb-3 w-full rounded-2xl border border-white/10 bg-white/90 px-4 py-4 text-maruxa-chocolate outline-none" />
      <input name="telefono" required placeholder="Teléfono" className="mb-3 w-full rounded-2xl border border-white/10 bg-white/90 px-4 py-4 text-maruxa-chocolate outline-none" />
      <input name="sabor" required placeholder="Tipo de torta / sabor" className="mb-3 w-full rounded-2xl border border-white/10 bg-white/90 px-4 py-4 text-maruxa-chocolate outline-none" />
      <input name="tamano" placeholder="Tamaño" className="mb-3 w-full rounded-2xl border border-white/10 bg-white/90 px-4 py-4 text-maruxa-chocolate outline-none" />
      <input name="fecha_retiro" required type="date" className="mb-3 w-full rounded-2xl border border-white/10 bg-white/90 px-4 py-4 text-maruxa-chocolate outline-none" />
      <input name="hora_retiro" required type="time" className="mb-3 w-full rounded-2xl border border-white/10 bg-white/90 px-4 py-4 text-maruxa-chocolate outline-none" />
      <input name="dedicatoria" placeholder="Dedicatoria" className="mb-3 w-full rounded-2xl border border-white/10 bg-white/90 px-4 py-4 text-maruxa-chocolate outline-none" />
      <textarea name="observaciones" placeholder="Observaciones" className="mb-3 min-h-28 w-full rounded-2xl border border-white/10 bg-white/90 px-4 py-4 text-maruxa-chocolate outline-none" />

      <button disabled={enviando} className="btn-rojo block w-full text-center">
        {enviando ? 'Enviando...' : 'Guardar y enviar por WhatsApp'}
      </button>
    </form>
  );
}
