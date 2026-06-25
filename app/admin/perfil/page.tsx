'use client';

import { BadgeCheck, Clock3, Mail, UserRound } from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';

export default function PerfilPage() {
  const { perfil, permisos } = useAdminSession();

  return (
    <div className="space-y-6 pb-12">
      <header>
        <p className="text-xs font-black uppercase tracking-wide text-[#A51F2B]">
          Cuenta personal
        </p>
        <h1 className="mt-2 text-3xl font-black text-[#2A1710]">Mi perfil</h1>
      </header>

      <section className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="rounded-lg border border-[#4B2818]/15 bg-white p-6">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[#A51F2B] text-white">
            <UserRound className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-2xl font-black text-[#2A1710]">
            {perfil?.funcionarios?.nombre_completo || perfil?.nombre_visible}
          </h2>
          <p className="mt-1 font-bold text-[#A51F2B]">
            {perfil?.funcionarios?.cargo || perfil?.rol}
          </p>
          <div className="mt-5 space-y-3 border-t border-[#4B2818]/10 pt-5 text-sm font-semibold text-[#4B2818]/70">
            <p className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4" />
              Cuenta activa
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Acceso protegido por Supabase Auth
            </p>
            <p className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              Sesión auditada
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-[#4B2818]/15 bg-white">
          <div className="border-b border-[#4B2818]/10 bg-[#FFF3DF] px-5 py-4">
            <h2 className="font-black text-[#2A1710]">Permisos asignados</h2>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {perfil?.rol === 'superadmin' || perfil?.rol === 'administrador' ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 font-black text-emerald-800">
                Acceso administrativo completo
              </div>
            ) : permisos.length === 0 ? (
              <p className="text-sm font-semibold text-[#4B2818]/60">
                No hay permisos de módulos asignados.
              </p>
            ) : (
              permisos.map((permiso) => (
                <div
                  key={permiso.modulo_codigo}
                  className="rounded-md border border-[#4B2818]/10 p-4"
                >
                  <p className="font-black capitalize text-[#2A1710]">
                    {permiso.modulo_codigo}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[#4B2818]/60">
                    {[
                      permiso.puede_ver && 'Ver',
                      permiso.puede_crear && 'Crear',
                      permiso.puede_editar && 'Editar',
                      permiso.puede_eliminar && 'Eliminar',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

