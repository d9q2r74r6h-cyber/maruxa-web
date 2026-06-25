'use client';

import { usePathname } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { AdminMenu } from '@/components/AdminMenu';
import { useAdminSession } from '@/components/AdminSession';

const modulosPorRuta = [
  ['/admin/informes/rinde', 'informe_rinde'],
  ['/admin/documentos', 'documentos'],
  ['/admin/clientes', 'clientes'],
  ['/admin/usuarios', 'usuarios'],
  ['/admin/auditoria', 'auditoria'],
  ['/admin/familias-productos', 'familias'],
  ['/admin/configuracion', 'empresa'],
  ['/admin/planillas', 'planillas'],
  ['/admin/produccion', 'produccion'],
  ['/admin/recetas', 'recetas'],
  ['/admin/compras', 'compras'],
  ['/admin/productos', 'productos'],
  ['/admin/pedidos', 'pedidos'],
] as const;

export function AdminLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { puedeVer } = useAdminSession();

  if (pathname === '/admin/login') return children;

  const moduloActual = modulosPorRuta.find(([ruta]) =>
    pathname.startsWith(ruta)
  )?.[1];
  const autorizado = !moduloActual || puedeVer(moduloActual);

  return (
    <main className="min-h-screen bg-maruxa-crema px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <AdminMenu />
        {autorizado ? (
          children
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center text-red-800">
            <ShieldAlert className="mx-auto h-10 w-10" />
            <h1 className="mt-3 text-xl font-black">Acceso restringido</h1>
            <p className="mt-2 text-sm font-semibold">
              Tu perfil no tiene permiso para consultar este módulo.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
