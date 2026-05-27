import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';

type Props = {
  params: Promise<{
    categoria: string;
  }>;
};

function formatearCategoria(categoria: string) {
  return categoria.replace(/-/g, ' ');
}

export async function generateStaticParams() {
  return [
    { categoria: 'tortas' },
    { categoria: 'pasteleria' },
    { categoria: 'panes' },
  ];
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { categoria } = await params;
  const nombreCategoria = formatearCategoria(categoria);

  return {
    title: `${nombreCategoria} | Panadería Maruxa`,
    description: `Conoce nuestra selección de ${nombreCategoria} en Panadería Maruxa. Productos artesanales con retiro en local.`,
    openGraph: {
      title: `${nombreCategoria} | Panadería Maruxa`,
      description: `Productos artesanales de Panadería Maruxa con retiro en local.`,
      url: `https://panaderiamaruxa.cl/categoria/${categoria}`,
      siteName: 'Panadería Maruxa',
      type: 'website',
    },
  };
}

export default async function CategoriaPage({ params }: Props) {
  const { categoria } = await params;
  const nombreCategoria = formatearCategoria(categoria);

  const { data: productos } = await supabase
    .from('productos')
    .select('*')
    .ilike('categoria', `%${nombreCategoria}%`)
    .not('slug', 'is', null);

  return (
    <main className="min-h-screen bg-maruxa-crema py-20">
      <div className="contenedor">
        <div className="mb-10 text-sm font-bold text-maruxa-cafe/70">
          <Link href="/" className="hover:text-maruxa-rojo">
            Inicio
          </Link>
          <span className="mx-2">/</span>
          <span className="text-maruxa-rojo capitalize">
            {nombreCategoria}
          </span>
        </div>

        <h1 className="text-6xl font-black capitalize tracking-[-.05em] text-maruxa-chocolate">
          {nombreCategoria}
        </h1>

        <p className="mt-5 max-w-2xl text-xl leading-8 text-maruxa-cafe/80">
          Productos artesanales de Panadería Maruxa con retiro en local.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {productos?.map((producto) => (
            <Link
              key={producto.id}
              href={`/productos/${producto.slug}`}
              className="overflow-hidden rounded-[34px] bg-white shadow-premium transition hover:-translate-y-1"
            >
              <div className="relative h-72 bg-maruxa-crema">
                {producto.imagen ? (
                  <Image
                    src={producto.imagen}
                    alt={producto.nombre}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-7xl">
                    🥐
                  </div>
                )}
              </div>

              <div className="p-6">
                <p className="text-xs font-black uppercase tracking-widest text-maruxa-rojo">
                  {producto.categoria}
                </p>

                <h2 className="mt-3 text-2xl font-black text-maruxa-chocolate">
                  {producto.nombre}
                </h2>

                <p className="mt-4 text-sm leading-6 text-maruxa-cafe/75">
                  {producto.descripcion}
                </p>

                <p className="mt-5 text-2xl font-black text-maruxa-vino">
                  ${producto.precio.toLocaleString('es-CL')}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}