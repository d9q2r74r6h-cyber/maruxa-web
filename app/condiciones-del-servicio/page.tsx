import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'Condiciones del servicio | Panadería Maruxa',
  description:
    'Condiciones aplicables al sitio web y los canales digitales de Panadería Maruxa.',
  alternates: { canonical: '/condiciones-del-servicio' },
};

const secciones = [
  {
    titulo: '1. Ámbito del servicio',
    texto:
      'Estas condiciones regulan el uso del sitio web, el catálogo, WhatsApp Business y los demás canales digitales de Panadería Maruxa. Al utilizarlos, la persona acepta estas condiciones y la Política de privacidad publicada en este sitio.',
  },
  {
    titulo: '2. Pedidos y disponibilidad',
    texto:
      'Los pedidos quedan sujetos a confirmación de disponibilidad, precio, fecha y horario de retiro. El envío de un carro o mensaje por WhatsApp no constituye por sí solo una aceptación definitiva. Panadería Maruxa podrá solicitar antecedentes adicionales para confirmar correctamente el pedido.',
  },
  {
    titulo: '3. Información de productos',
    texto:
      'Procuramos mantener actualizados los productos, precios, fotografías y descripciones. Las imágenes son referenciales y pueden existir variaciones propias de una elaboración artesanal. Cuando corresponda, informaremos cambios relevantes antes de confirmar el pedido.',
  },
  {
    titulo: '4. Uso permitido',
    texto:
      'Los canales digitales deben utilizarse de forma lícita y respetuosa. No está permitido intentar acceder a funciones restringidas, interferir con el servicio, enviar contenido malicioso, suplantar a terceros ni utilizar la información del sitio con fines fraudulentos.',
  },
  {
    titulo: '5. Comunicaciones por WhatsApp',
    texto:
      'WhatsApp se utiliza para recibir consultas y pedidos, confirmar información y prestar atención al cliente. El servicio también está sujeto a las condiciones de WhatsApp y Meta. Panadería Maruxa no solicita contraseñas ni códigos de verificación mediante conversaciones de atención.',
  },
  {
    titulo: '6. Privacidad y eliminación de datos',
    texto:
      'El tratamiento de datos personales se explica en nuestra Política de privacidad. Las solicitudes de acceso, corrección o eliminación pueden presentarse mediante la página de Eliminación de datos disponible en este sitio.',
  },
  {
    titulo: '7. Cambios y contacto',
    texto:
      'Estas condiciones pueden actualizarse cuando cambien los servicios o las exigencias aplicables. Para consultas, puedes escribir a contacto@panaderiamaruxa.cl o dirigirte a Avenida Santa Rosa 6019, San Miguel, Chile.',
  },
];

export default function CondicionesDelServicioPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-maruxa-crema px-5 py-14">
        <article className="mx-auto max-w-4xl">
          <Link href="/" className="text-sm font-black text-[#A51F2B] hover:underline">
            Volver a Panadería Maruxa
          </Link>
          <p className="mt-10 text-xs font-black uppercase text-[#A51F2B]">
            Información legal
          </p>
          <h1 className="mt-3 text-4xl font-black text-[#2A1710] md:text-5xl">
            Condiciones del servicio
          </h1>
          <p className="mt-4 font-semibold text-[#4B2818]/70">
            Última actualización: 21 de agosto de 2026.
          </p>

          <div className="mt-10 divide-y divide-[#4B2818]/15 border-y border-[#4B2818]/15">
            {secciones.map((seccion) => (
              <section key={seccion.titulo} className="py-7">
                <h2 className="text-xl font-black text-[#2A1710]">{seccion.titulo}</h2>
                <p className="mt-3 text-base font-medium leading-7 text-[#4B2818]/80">
                  {seccion.texto}
                </p>
              </section>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-4 text-sm font-black text-[#A51F2B]">
            <Link href="/politica-de-privacidad" className="underline">
              Política de privacidad
            </Link>
            <Link href="/eliminacion-de-datos" className="underline">
              Eliminación de datos
            </Link>
          </div>
        </article>
      </main>
    </>
  );
}
