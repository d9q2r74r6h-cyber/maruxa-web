import Link from 'next/link';
import {
  Package,
  ClipboardList,
  BarChart3,
  Settings,
} from 'lucide-react';

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-maruxa-crema px-5 py-16">
      <div className="mx-auto max-w-6xl">
        <p className="font-black uppercase tracking-[.24em] text-maruxa-rojo">
          Administración
        </p>

        <h1 className="mt-3 text-5xl font-black text-maruxa-chocolate">
          Panel Maruxa
        </h1>

        <p className="mt-3 max-w-2xl font-bold text-maruxa-cafe/70">
          Gestiona productos, pedidos y ventas de Panadería Maruxa.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <Link
            href="/admin/productos"
            className="rounded-[34px] bg-white p-7 shadow-premium transition hover:-translate-y-1 hover:shadow-xl"
          >
            <Package className="h-10 w-10 text-maruxa-rojo" />

            <h2 className="mt-6 text-2xl font-black text-maruxa-chocolate">
              Productos
            </h2>

            <p className="mt-2 font-bold text-maruxa-cafe/70">
              Crear, editar y administrar productos del catálogo.
            </p>
          </Link>

          <Link
            href="/admin/pedidos"
            className="rounded-[34px] bg-white p-7 shadow-premium transition hover:-translate-y-1 hover:shadow-xl"
          >
            <ClipboardList className="h-10 w-10 text-maruxa-rojo" />

            <h2 className="mt-6 text-2xl font-black text-maruxa-chocolate">
              Pedidos
            </h2>

            <p className="mt-2 font-bold text-maruxa-cafe/70">
              Revisar pedidos, estados, clientes y WhatsApp.
            </p>
          </Link>

          <Link
            href="/admin/pedidos"
            className="rounded-[34px] bg-white p-7 shadow-premium transition hover:-translate-y-1 hover:shadow-xl"
          >
            <BarChart3 className="h-10 w-10 text-maruxa-rojo" />

            <h2 className="mt-6 text-2xl font-black text-maruxa-chocolate">
              Ventas
            </h2>

            <p className="mt-2 font-bold text-maruxa-cafe/70">
              Ver dashboard de ventas y resumen de pedidos.
            </p>
          </Link>
        </div>

        <div className="mt-8 rounded-[34px] bg-maruxa-rojo p-7 text-blue-700/80 shadow-premium">
          <Settings className="h-8 w-8" />

          <h2 className="mt-2 font-bold text-blue-700/80">
            Próximamente
          </h2>

          <p className="mt-2 font-bold text-blue-700/80">
            Mercado Pago, Analytics, Meta Pixel, TikTok Pixel y SEO avanzado.
          </p>
        </div>
      </div>
    </main>
  );
}