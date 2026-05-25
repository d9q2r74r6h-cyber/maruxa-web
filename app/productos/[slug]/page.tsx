import ProductoDetalle from '@/components/ProductoDetalle';

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ProductoPage({ params }: Props) {
  const { slug } = await params;
  return <ProductoDetalle slug={slug} />;
}