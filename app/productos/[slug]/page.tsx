import type { Metadata } from 'next';
import ProductoDetalle from '@/components/ProductoDetalle';
import { obtenerProductosCatalogo } from '@/lib/catalogo-publico';

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  const { data } = await obtenerProductosCatalogo();

  return (
    data?.map((producto) => ({
      slug: producto.slug,
    })) ?? []
  );
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { slug } = await params;

  const nombreProducto = slug.replace(/-/g, ' ');

  return {
    title: `${nombreProducto} | Panadería Maruxa`,
    description: `Conoce ${nombreProducto} de Panadería Maruxa. Producto artesanal con retiro en local.`,
    openGraph: {
      title: `${nombreProducto} | Panadería Maruxa`,
      description: `Producto artesanal de Panadería Maruxa con retiro en local.`,
      url: `https://panaderiamaruxa.cl/productos/${slug}`,
      siteName: 'Panadería Maruxa',
      type: 'website',
    },
  };
}

export default async function ProductoPage({ params }: Props) {
  const { slug } = await params;

  return <ProductoDetalle slug={slug} />;
}
