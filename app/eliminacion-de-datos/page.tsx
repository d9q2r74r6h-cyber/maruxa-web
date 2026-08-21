import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'Eliminación de datos | Panadería Maruxa',
  description:
    'Instrucciones para solicitar la eliminación de datos personales en Panadería Maruxa.',
  alternates: { canonical: '/eliminacion-de-datos' },
};

export default function EliminacionDeDatosPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-maruxa-crema px-5 py-14">
        <article className="mx-auto max-w-4xl">
          <Link href="/" className="text-sm font-black text-[#A51F2B] hover:underline">
            Volver a Panadería Maruxa
          </Link>
          <p className="mt-10 text-xs font-black uppercase text-[#A51F2B]">
            Privacidad y datos personales
          </p>
          <h1 className="mt-3 text-4xl font-black text-[#2A1710] md:text-5xl">
            Solicitud de eliminación de datos
          </h1>
          <p className="mt-4 font-semibold text-[#4B2818]/70">
            Última actualización: 21 de agosto de 2026.
          </p>

          <div className="mt-10 divide-y divide-[#4B2818]/15 border-y border-[#4B2818]/15">
            <section className="py-7">
              <h2 className="text-xl font-black text-[#2A1710]">Cómo solicitarla</h2>
              <p className="mt-3 text-base font-medium leading-7 text-[#4B2818]/80">
                Envía un correo a{' '}
                <a href="mailto:contacto@panaderiamaruxa.cl?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20datos" className="font-black text-[#A51F2B] underline">
                  contacto@panaderiamaruxa.cl
                </a>{' '}
                con el asunto “Solicitud de eliminación de datos”. Indica tu nombre, el número de teléfono o correo utilizado para comunicarte con Panadería Maruxa y qué información deseas eliminar.
              </p>
            </section>

            <section className="py-7">
              <h2 className="text-xl font-black text-[#2A1710]">Verificación de identidad</h2>
              <p className="mt-3 text-base font-medium leading-7 text-[#4B2818]/80">
                Para impedir eliminaciones solicitadas por terceros, podremos pedir información adicional estrictamente necesaria para verificar que la solicitud corresponde al titular de los datos.
              </p>
            </section>

            <section className="py-7">
              <h2 className="text-xl font-black text-[#2A1710]">Datos comprendidos</h2>
              <p className="mt-3 text-base font-medium leading-7 text-[#4B2818]/80">
                La solicitud puede comprender datos de contacto, mensajes, identificadores asociados a WhatsApp y registros internos vinculados a consultas o pedidos. Informaremos la atención de la solicitud utilizando el mismo correo de contacto.
              </p>
            </section>

            <section className="py-7">
              <h2 className="text-xl font-black text-[#2A1710]">Registros que deben conservarse</h2>
              <p className="mt-3 text-base font-medium leading-7 text-[#4B2818]/80">
                Algunos antecedentes podrán conservarse cuando sean necesarios para cumplir obligaciones tributarias, contables, contractuales o legales, resolver controversias o proteger la seguridad del servicio. En esos casos explicaremos el alcance de la conservación aplicable.
              </p>
            </section>

            <section className="py-7">
              <h2 className="text-xl font-black text-[#2A1710]">Datos obtenidos mediante Meta</h2>
              <p className="mt-3 text-base font-medium leading-7 text-[#4B2818]/80">
                Estas instrucciones también se aplican a los datos que Panadería Maruxa recibe mediante sus integraciones autorizadas con WhatsApp Business y otros servicios de Meta.
              </p>
            </section>
          </div>

          <div className="mt-8 flex flex-wrap gap-4 text-sm font-black text-[#A51F2B]">
            <Link href="/politica-de-privacidad" className="underline">
              Política de privacidad
            </Link>
            <Link href="/condiciones-del-servicio" className="underline">
              Condiciones del servicio
            </Link>
          </div>
        </article>
      </main>
    </>
  );
}
