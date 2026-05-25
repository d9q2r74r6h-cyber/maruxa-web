import { ArrowRight, Clock, MapPin, Sparkles } from 'lucide-react';
import { MARUXA } from '@/lib/marca';

export default function Hero() {
  return (
    <section id="inicio" className="relative overflow-hidden py-12 lg:py-20">
      <div className="absolute -right-24 top-12 h-72 w-72 rounded-full bg-[#bc3038]/20 blur-3xl" />
      <div className="absolute -left-24 bottom-10 h-80 w-80 rounded-full bg-[#e9cdb5]/70 blur-3xl" />

      <div className="contenedor grid items-center gap-10 lg:grid-cols-[1.04fr_.96fr]">
        <div className="relative z-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#bc3038]/15 bg-white/60 px-4 py-2 text-sm font-black text-[#8f2028] shadow-sm">
            <Sparkles size={16}/> Desde 1962 · Panadería de barrio
          </div>
          <h1 className="titulo-premium max-w-4xl text-6xl font-black text-[#8f2028] md:text-8xl lg:text-9xl">
            Panadería Maruxa, tradición artesanal en San Miguel.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#5b321c] md:text-xl">
            Web renovada usando la identidad real de Maruxa: rojo clásico, crema del logo, sello de barrio y pedidos simples para panadería, pastelería y tortas.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a className="boton-principal !bg-[#bc3038] hover:!bg-[#8f2028]" href="#tortas">Encargar una torta <ArrowRight size={19}/></a>
            <a className="boton-secundario !border-[#bc3038]/20 !text-[#8f2028]" href="#catalogo">Ver catálogo</a>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <div className="card-premium rounded-3xl p-5"><p className="text-3xl font-black text-[#bc3038]">1962</p><p className="text-sm font-bold text-[#7a4a2b]">tradición de barrio</p></div>
            <div className="card-premium rounded-3xl p-5"><p className="text-3xl font-black text-[#bc3038]">24h</p><p className="text-sm font-bold text-[#7a4a2b]">mínimo para tortas</p></div>
            <div className="card-premium rounded-3xl p-5"><p className="text-3xl font-black text-[#bc3038]">100%</p><p className="text-sm font-bold text-[#7a4a2b]">retiro en local</p></div>
          </div>
        </div>

        <div className="relative min-h-[620px]">
          <div className="absolute left-5 top-0 h-[520px] w-[72%] rotate-[-5deg] rounded-[3rem] bg-[#8f2028] shadow-2xl" />
          <div className="absolute right-0 top-12 h-[560px] w-[82%] overflow-hidden rounded-[3rem] bg-[#bc3038] p-5 sombra-suave">
            <div className="relative h-full overflow-hidden rounded-[2.2rem] border border-[#e9cdb5]/50 bg-[#e9cdb5]">
              <img src={MARUXA.fotoHero} alt="Producto Panadería Maruxa" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#8f2028]/85 via-transparent to-transparent" />
              <img src={MARUXA.logo} alt="Logo Maruxa" className="absolute left-6 top-6 w-56 rounded-xl shadow-xl" />
              <div className="absolute bottom-6 left-6 right-6 rounded-[2rem] bg-[#e9cdb5]/90 p-6 text-[#8f2028] backdrop-blur-md">
                <p className="titulo-premium text-5xl font-black">Sabor de barrio</p>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#5b321c]">Pan, pastelería y tortas con identidad Maruxa.</p>
              </div>
            </div>
          </div>
          <div className="absolute bottom-8 left-0 rounded-[2rem] bg-white p-5 shadow-2xl">
            <p className="flex items-center gap-2 text-sm font-black text-[#8f2028]"><Clock size={16}/> Retiro coordinado</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-[#7a4a2b]"><MapPin size={16}/> {MARUXA.direccion}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
