'use client';
import { useMemo, useState } from 'react';
import { CalendarClock, MessageCircle, ShieldCheck } from 'lucide-react';

export default function PedidoTortas() {
  const [form, setForm] = useState({ nombre:'', torta:'Milhojas manjar', personas:'15', fecha:'', hora:'12:00', dedicatoria:'' });
  const whatsapp = useMemo(() => {
    const texto = `Hola Maruxa, quiero encargar una torta.%0A%0ANombre: ${form.nombre}%0ATorta: ${form.torta}%0APersonas: ${form.personas}%0AFecha retiro: ${form.fecha}%0AHora retiro: ${form.hora}%0ADedicatoria: ${form.dedicatoria}%0A%0AEntiendo que el retiro es en local y requiere mínimo 24 horas.`;
    return `https://wa.me/56233663241?text=${texto}`;
  }, [form]);
  const cambia = (e:any) => setForm({...form, [e.target.name]: e.target.value});

  return (
    <section id="tortas" className="relative overflow-hidden py-24">
      <div className="absolute inset-0 bg-[#8f2028]" />
      <div className="absolute inset-0 opacity-20" style={{backgroundImage:'radial-gradient(circle at 25% 20%, #bc3038 0 10%, transparent 11%), radial-gradient(circle at 75% 70%, #e9cdb5 0 8%, transparent 9%)'}} />
      <div className="contenedor relative grid gap-10 lg:grid-cols-[.9fr_1.1fr]">
        <div className="text-[#f6eadc]">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black">Pedidos especiales</span>
          <h2 className="titulo-premium mt-6 text-6xl font-black md:text-8xl">Tortas para retirar en local</h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/78">Formulario directo a WhatsApp. Después podemos conectarlo con base de datos, estados de pedido y panel de administración.</p>
          <div className="mt-8 grid gap-3">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5"><CalendarClock/> <p className="mt-3 font-black">Mínimo 24 horas de anticipación</p></div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5"><ShieldCheck/> <p className="mt-3 font-black">Retiro solamente en local</p></div>
          </div>
        </div>
        <form className="rounded-[2.5rem] bg-[#f6eadc] p-6 shadow-2xl md:p-9" onSubmit={(e)=>e.preventDefault()}>
          <div className="grid gap-4 md:grid-cols-2">
            <input className="input-maruxa md:col-span-2" name="nombre" placeholder="Nombre cliente" onChange={cambia}/>
            <select className="input-maruxa" name="torta" value={form.torta} onChange={cambia}><option>Milhojas manjar</option><option>Chocolate frambuesa</option><option>Bizcocho lúcuma</option><option>Personalizada</option></select>
            <input className="input-maruxa" name="personas" placeholder="Personas" value={form.personas} onChange={cambia}/>
            <input className="input-maruxa" type="date" name="fecha" onChange={cambia}/>
            <input className="input-maruxa" type="time" name="hora" value={form.hora} onChange={cambia}/>
            <textarea className="input-maruxa md:col-span-2 min-h-28" name="dedicatoria" placeholder="Dedicatoria o detalle especial" onChange={cambia}/>
          </div>
          <a className="boton-principal mt-6 w-full" href={whatsapp} target="_blank"><MessageCircle size={20}/> Enviar pedido por WhatsApp</a>
          <p className="mt-4 text-center text-sm font-bold text-[#7a4a2b]">Teléfono principal: +56 2 3366 3241</p>
        </form>
      </div>
    </section>
  );
}
