'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  LogOut,
  ShieldCheck,
  UserCircle,
} from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';

type MenuItem = {
  label: string;
  href?: string;
  future?: boolean;
  modulo?: string;
};

const grupos: {
  id: string;
  label: string;
  items: MenuItem[];
}[] = [
  {
    id: 'comercial',
    label: 'Comercial',
    items: [
      { label: 'Pedidos', href: '/admin/pedidos', modulo: 'pedidos' },
      { label: 'Documentos tributarios', href: '/admin/documentos', modulo: 'documentos' },
      { label: 'Clientes', href: '/admin/clientes', modulo: 'clientes' },
    ],
  },
  {
    id: 'inventario',
    label: 'Inventario',
    items: [
      { label: 'Productos', href: '/admin/productos', modulo: 'productos' },
      { label: 'Compras', href: '/admin/compras', modulo: 'compras' },
      { label: 'Kardex / movimientos', future: true },
      { label: 'Historial de costos', future: true },
    ],
  },
  {
    id: 'produccion',
    label: 'Produccion',
    items: [
      { label: 'Recetas', href: '/admin/recetas', modulo: 'recetas' },
      { label: 'Fabricacion', href: '/admin/produccion', modulo: 'produccion' },
      { label: 'Rinde por saco', href: '/admin/planillas', modulo: 'planillas' },
      { label: 'Historial produccion', future: true },
    ],
  },
  {
    id: 'informes',
    label: 'Informes',
    items: [
      { label: 'Rinde mensual', href: '/admin/informes/rinde', modulo: 'informe_rinde' },
      { label: 'Costos', future: true },
      { label: 'Rentabilidad', future: true },
      { label: 'Stock critico', future: true },
      { label: 'Ventas por periodo', future: true },
    ],
  },
  {
    id: 'config',
    label: 'Configuracion',
    items: [
      { label: 'Familias de productos', href: '/admin/familias-productos', modulo: 'familias' },
      { label: 'Empresa', href: '/admin/configuracion', modulo: 'empresa' },
      { label: 'Politica de precios', future: true },
      { label: 'Usuarios y permisos', href: '/admin/usuarios', modulo: 'usuarios' },
      { label: 'Auditoria', href: '/admin/auditoria', modulo: 'auditoria' },
    ],
  },
];

export function AdminMenu() {
  const pathname = usePathname();
  const { perfil, puedeVer, cerrarSesion } = useAdminSession();
  const [open, setOpen] = useState<string | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function cerrarSiClickAfuera(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(null);
      }
    }

    document.addEventListener('mousedown', cerrarSiClickAfuera);

    return () => {
      document.removeEventListener('mousedown', cerrarSiClickAfuera);
    };
  }, []);

  function esActivo(href?: string) {
    if (!href) return false;
    if (href === '/admin') return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav
      ref={menuRef}
      className="relative z-40 mb-8 rounded-2xl border border-[#A51F2B]/10 bg-white/95 px-3 py-2 shadow-sm backdrop-blur"
    >
      <div className="flex flex-wrap items-center gap-1.5 text-sm font-black text-[#2A1710]">
        <Link
          href="/admin"
          className={`rounded-xl px-3.5 py-2 transition ${
            esActivo('/admin')
              ? 'bg-[#2A1710] text-white shadow-sm'
              : 'text-[#4B2818] hover:bg-[#FFF3DF] hover:text-[#A51F2B]'
          }`}
        >
          Inicio
        </Link>

        {grupos.map((grupo) => {
          const itemsVisibles = grupo.items.filter(
            (item) => item.future || !item.modulo || puedeVer(item.modulo)
          );
          const activo = itemsVisibles.some((item) => esActivo(item.href));
          const abierto = open === grupo.id;

          if (itemsVisibles.length === 0) return null;

          return (
            <div key={grupo.id} className="relative">
              <button
                type="button"
                onClick={() => setOpen(abierto ? null : grupo.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 transition ${
                  activo
                    ? 'bg-[#2A1710] text-white shadow-sm'
                    : abierto
                      ? 'bg-[#FFF3DF] text-[#A51F2B]'
                      : 'text-[#4B2818] hover:bg-[#FFF3DF] hover:text-[#A51F2B]'
                }`}
              >
                <span>{grupo.label}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`h-4 w-4 transition-transform ${abierto ? 'rotate-180' : ''}`}
                />
              </button>

              {abierto && (
                <div className="absolute left-0 top-[calc(100%+0.5rem)] z-[100] w-[min(18rem,calc(100vw-2.5rem))] overflow-hidden rounded-xl border border-[#A51F2B]/15 bg-white text-[#2A1710] shadow-[0_18px_45px_rgba(42,23,16,0.2)]">
                  <div className="border-b border-[#A51F2B]/10 bg-[#FFF3DF] px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-wide text-[#A51F2B]">
                      {grupo.label}
                    </p>
                  </div>

                  <div className="p-2">
                    {itemsVisibles.map((item) =>
                      item.future ? (
                        <div
                          key={item.label}
                          className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-gray-400"
                        >
                          <span>{item.label}</span>
                          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
                            Proximo
                          </span>
                        </div>
                      ) : (
                        <Link
                          key={item.href}
                          href={item.href || '#'}
                          onClick={() => setOpen(null)}
                          className={`block rounded-lg px-3 py-2.5 transition ${
                            esActivo(item.href)
                              ? 'bg-[#A51F2B] text-white'
                              : 'text-[#4B2818] hover:bg-[#FFF3DF] hover:text-[#A51F2B]'
                          }`}
                        >
                          {item.label}
                        </Link>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="ml-auto flex items-center gap-1 border-l border-[#4B2818]/10 pl-2">
          <Link
            href="/admin/perfil"
            title="Mi perfil"
            className="flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-[#FFF3DF]"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#A51F2B] text-white">
              <UserCircle className="h-5 w-5" />
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-40 truncate text-xs font-black text-[#2A1710]">
                {perfil?.funcionarios?.nombre_completo ||
                  perfil?.nombre_visible}
              </p>
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#A51F2B]">
                <ShieldCheck className="h-3 w-3" />
                {perfil?.funcionarios?.cargo || perfil?.rol}
              </p>
            </div>
          </Link>
          <button
            type="button"
            title="Cerrar sesión"
            onClick={cerrarSesion}
            className="grid h-9 w-9 place-items-center rounded-lg text-[#4B2818]/60 transition hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
