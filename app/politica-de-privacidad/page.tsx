import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'Política de privacidad | Panadería Maruxa',
  description:
    'Información sobre el tratamiento de datos personales en Panadería Maruxa.',
  alternates: {
    canonical: '/politica-de-privacidad',
  },
};

const secciones = [
  {
    titulo: '1. Responsable del tratamiento',
    contenido: (
      <>
        Panadería Maruxa, con domicilio en Avenida Santa Rosa 6019, San Miguel,
        Chile, es responsable del tratamiento de los datos personales obtenidos
        mediante este sitio web, WhatsApp Business y sus canales de atención.
      </>
    ),
  },
  {
    titulo: '2. Datos que recopilamos',
    contenido: (
      <>
        Podemos recopilar nombre, teléfono, correo electrónico, dirección,
        información tributaria, productos solicitados, preferencias, fecha de
        retiro, mensajes, identificadores técnicos de WhatsApp y antecedentes
        necesarios para gestionar pedidos, pagos, facturas y atención al
        cliente.
      </>
    ),
  },
  {
    titulo: '3. Uso de la información',
    contenido: (
      <>
        Utilizamos los datos para registrar y preparar pedidos, confirmar
        disponibilidad, comunicarnos con el cliente, emitir documentos
        tributarios, responder consultas, mantener historial comercial,
        prevenir duplicados o fraudes y mejorar nuestros procesos de atención.
        No vendemos datos personales.
      </>
    ),
  },
  {
    titulo: '4. WhatsApp Business',
    contenido: (
      <>
        Cuando una persona conversa con Maruxa o envía un carro mediante
        WhatsApp, recibimos los datos del mensaje y del pedido necesarios para
        incorporarlo a nuestro sistema. El uso de WhatsApp también está sujeto
        a las condiciones y políticas de privacidad de Meta y WhatsApp.
      </>
    ),
  },
  {
    titulo: '5. Proveedores y encargados',
    contenido: (
      <>
        Podemos utilizar proveedores tecnológicos para alojamiento, base de
        datos, correo, mensajería, analítica y procesamiento de pagos. Estos
        proveedores reciben únicamente la información necesaria para prestar
        sus servicios y están sujetos a sus propias obligaciones de seguridad y
        confidencialidad.
      </>
    ),
  },
  {
    titulo: '6. Conservación y seguridad',
    contenido: (
      <>
        Conservamos la información durante el tiempo necesario para atender el
        pedido, cumplir obligaciones comerciales, tributarias y legales, y
        resolver consultas o reclamos. Aplicamos controles de acceso y medidas
        técnicas razonables para protegerla contra pérdida, uso indebido o
        acceso no autorizado.
      </>
    ),
  },
  {
    titulo: '7. Derechos y eliminación',
    contenido: (
      <>
        Puedes solicitar información, corrección o eliminación de tus datos,
        cuando corresponda, escribiendo a{' '}
        <a
          href="mailto:pedidos@panaderiamaruxa.cl"
          className="font-black text-[#A51F2B] underline"
        >
          pedidos@panaderiamaruxa.cl
        </a>
        . Para proteger al titular, podremos solicitar antecedentes que permitan
        verificar su identidad. Ciertos registros deberán conservarse cuando
        exista una obligación legal o tributaria.
      </>
    ),
  },
  {
    titulo: '8. Cambios a esta política',
    contenido: (
      <>
        Esta política puede actualizarse cuando cambien nuestros servicios,
        proveedores o exigencias aplicables. La versión vigente siempre estará
        disponible en esta dirección.
      </>
    ),
  },
];

export default function PoliticaDePrivacidadPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-maruxa-crema px-5 py-14">
        <article className="mx-auto max-w-4xl">
          <Link
            href="/"
            className="text-sm font-black text-[#A51F2B] hover:underline"
          >
            Volver a Panadería Maruxa
          </Link>

          <p className="mt-10 text-xs font-black uppercase text-[#A51F2B]">
            Privacidad y datos personales
          </p>
          <h1 className="mt-3 text-4xl font-black text-[#2A1710] md:text-5xl">
            Política de privacidad
          </h1>
          <p className="mt-4 font-semibold text-[#4B2818]/70">
            Vigente desde el 25 de junio de 2026.
          </p>

          <div className="mt-10 divide-y divide-[#4B2818]/15 border-y border-[#4B2818]/15">
            {secciones.map((seccion) => (
              <section key={seccion.titulo} className="py-7">
                <h2 className="text-xl font-black text-[#2A1710]">
                  {seccion.titulo}
                </h2>
                <div className="mt-3 text-base font-medium leading-7 text-[#4B2818]/80">
                  {seccion.contenido}
                </div>
              </section>
            ))}
          </div>
        </article>
      </main>
    </>
  );
}
