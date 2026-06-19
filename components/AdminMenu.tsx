'use client';

import Link from 'next/link';
import { useState } from 'react';

export function AdminMenu() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <nav className="mb-8 rounded-2xl border bg-white px-5 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-6 text-sm font-black text-maruxa-chocolate">
        <Link href="/admin/dashboard" className="hover:text-maruxa-rojo">
          Dashboard
        </Link>

        <div className="relative">
          <button onClick={() => setOpen(open === 'productos' ? null : 'productos')}>
            Productos ▾
          </button>
          {open === 'productos' && (
            <div className="absolute left-0 top-8 z-50 w-56 rounded-xl border bg-white p-2 shadow-lg">
              <Link className="block rounded-lg px-3 py-2 hover:bg-maruxa-crema" href="/admin/productos">Todos</Link>
              <Link className="block rounded-lg px-3 py-2 hover:bg-maruxa-crema" href="/admin/productos?tipo=producto">Terminados</Link>
              <Link className="block rounded-lg px-3 py-2 hover:bg-maruxa-crema" href="/admin/productos?tipo=ingrediente">Ingredientes</Link>
              <Link className="block rounded-lg px-3 py-2 hover:bg-maruxa-crema" href="/admin/productos?tipo=envase">Envases</Link>
            </div>
          )}
        </div>

        <div className="relative">
  <button
    onClick={() =>
      setOpen(open === 'produccion' ? null : 'produccion')
    }
  >
    Producción ▾
  </button>

  {open === 'produccion' && (
    <div className="absolute left-0 top-8 z-50 w-64 rounded-xl border bg-white p-2 shadow-lg">
      <Link
        href="/admin/recetas"
        className="block rounded-lg px-3 py-2 hover:bg-maruxa-crema"
      >
        📖 Recetas
      </Link>

      <Link
        href="/admin/produccion"
        className="block rounded-lg px-3 py-2 hover:bg-maruxa-crema"
      >
        🏭 Fabricación
      </Link>

      <Link
        href="/admin/produccion/historial"
        className="block rounded-lg px-3 py-2 text-gray-400 cursor-not-allowed"
      >
        📋 Historial (próximamente)
      </Link>
    </div>
  )}
</div>
        <div className="relative">
  <button onClick={() => setOpen(open === 'informes' ? null : 'informes')}>
    Informes ▾
  </button>

  {open === 'informes' && (
    <div className="absolute left-0 top-8 z-50 w-60 rounded-xl border bg-white p-2 shadow-lg">
      <Link className="block rounded-lg px-3 py-2 hover:bg-maruxa-crema" href="/admin/informes/ventas">
        Ventas
      </Link>
      <Link className="block rounded-lg px-3 py-2 hover:bg-maruxa-crema" href="/admin/informes/costos">
        Costos
      </Link>
      <Link className="block rounded-lg px-3 py-2 hover:bg-maruxa-crema" href="/admin/informes/produccion">
        Producción
      </Link>
      <Link className="block rounded-lg px-3 py-2 hover:bg-maruxa-crema" href="/admin/informes/rentabilidad">
        Rentabilidad
      </Link>
    </div>
  )}
</div>

        <Link href="/admin/pedidos" className="hover:text-maruxa-rojo">
          Pedidos
        </Link>

        <div className="relative">
          <button onClick={() => setOpen(open === 'config' ? null : 'config')}>
            Configuración ▾
          </button>
          {open === 'config' && (
            <div className="absolute left-0 top-8 z-50 w-56 rounded-xl border bg-white p-2 shadow-lg">
              <Link className="block rounded-lg px-3 py-2 hover:bg-maruxa-crema" href="/admin/familias">Familias</Link>
              <Link className="block rounded-lg px-3 py-2 hover:bg-maruxa-crema" href="/admin/configuracion">Empresa</Link>
              <Link className="block rounded-lg px-3 py-2 hover:bg-maruxa-crema" href="/admin/configuracion/precios">Política de precios</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}