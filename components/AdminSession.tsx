'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export type PermisoModulo = {
  modulo_codigo: string;
  puede_ver: boolean;
  puede_crear: boolean;
  puede_editar: boolean;
  puede_eliminar: boolean;
};

export type PerfilUsuario = {
  id: string;
  empresa_id: string;
  funcionario_id: string | null;
  nombre_visible: string;
  rol: string;
  activo: boolean;
  ultimo_acceso?: string | null;
  funcionarios?: {
    nombre_completo: string;
    cargo: string;
  } | null;
};

type SesionAdmin = {
  perfil: PerfilUsuario | null;
  permisos: PermisoModulo[];
  cargando: boolean;
  esAdmin: boolean;
  puedeVer: (modulo: string) => boolean;
  cerrarSesion: () => Promise<void>;
  recargar: () => Promise<void>;
};

const AdminSessionContext = createContext<SesionAdmin | null>(null);

export function useAdminSession() {
  const contexto = useContext(AdminSessionContext);
  if (!contexto) {
    throw new Error('useAdminSession debe usarse dentro de AdminSessionProvider.');
  }
  return contexto;
}

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [permisos, setPermisos] = useState<PermisoModulo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorSesion, setErrorSesion] = useState('');

  async function cargarSesion() {
    setCargando(true);
    setErrorSesion('');

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setPerfil(null);
      setPermisos([]);
      if (pathname !== '/admin/login') {
        router.replace('/admin/login');
        return;
      }
      setCargando(false);
      return;
    }

    const { data: perfilData, error } = await supabase
      .from('perfiles_usuario')
      .select(
        'id, empresa_id, funcionario_id, nombre_visible, rol, activo, ultimo_acceso'
      )
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) {
      setPerfil(null);
      setPermisos([]);
      setErrorSesion(`No se pudo cargar el perfil: ${error.message}`);
      setCargando(false);
      return;
    }

    if (!perfilData) {
      setPerfil(null);
      setPermisos([]);
      setErrorSesion(
        `La sesión existe, pero falta el perfil ERP para ${session.user.email}.`
      );
      setCargando(false);
      return;
    }

    if (!perfilData.activo) {
      setPerfil(null);
      setPermisos([]);
      setErrorSesion('Este usuario está desactivado en el ERP.');
      setCargando(false);
      return;
    }

    const { data: permisosData } = await supabase
      .from('usuario_permisos')
      .select('*')
      .eq('usuario_id', session.user.id);

    let funcionarioRelacion: PerfilUsuario['funcionarios'] = null;

    if (perfilData.funcionario_id) {
      const { data: funcionarioData } = await supabase
        .from('funcionarios')
        .select('nombre_completo, cargo')
        .eq('id', perfilData.funcionario_id)
        .maybeSingle();

      funcionarioRelacion = funcionarioData || null;
    }

    setPerfil({
      ...perfilData,
      funcionarios: funcionarioRelacion,
    } as PerfilUsuario);
    setPermisos((permisosData || []) as PermisoModulo[]);
    setCargando(false);

    const ultimoAcceso = perfilData.ultimo_acceso
      ? new Date(perfilData.ultimo_acceso).getTime()
      : 0;

    if (Date.now() - ultimoAcceso > 15 * 60 * 1000) {
      await supabase
        .from('perfiles_usuario')
        .update({ ultimo_acceso: new Date().toISOString() })
        .eq('id', session.user.id);
    }

    if (pathname === '/admin/login') router.replace('/admin');
  }

  useEffect(() => {
    cargarSesion();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => {
        cargarSesion();
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  const esAdmin =
    perfil?.rol === 'superadmin' || perfil?.rol === 'administrador';

  const valor = useMemo<SesionAdmin>(
    () => ({
      perfil,
      permisos,
      cargando,
      esAdmin,
      puedeVer(modulo) {
        if (esAdmin) return true;
        return permisos.some(
          (permiso) =>
            permiso.modulo_codigo === modulo && permiso.puede_ver
        );
      },
      async cerrarSesion() {
        await supabase.auth.signOut();
        router.replace('/admin/login');
      },
      recargar: cargarSesion,
    }),
    [cargando, esAdmin, perfil, permisos]
  );

  if (pathname === '/admin/login') {
    return (
      <AdminSessionContext.Provider value={valor}>
        {children}
      </AdminSessionContext.Provider>
    );
  }

  if (cargando) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#FFF3DF]">
        <div className="flex items-center gap-3 font-black text-[#4B2818]">
          <Loader2 className="h-6 w-6 animate-spin text-[#A51F2B]" />
          Iniciando sesión...
        </div>
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#FFF3DF] px-5">
        <div className="w-full max-w-lg rounded-lg border border-red-200 bg-white p-7 text-center shadow-lg">
          <h1 className="text-xl font-black text-[#2A1710]">
            No se pudo abrir el panel
          </h1>
          <p className="mt-3 text-sm font-semibold text-red-700">
            {errorSesion || 'No se encontró un perfil activo para esta sesión.'}
          </p>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace('/admin/login');
            }}
            className="mt-5 h-10 rounded-md bg-[#A51F2B] px-4 font-black text-white"
          >
            Volver al acceso
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminSessionContext.Provider value={valor}>
      {children}
    </AdminSessionContext.Provider>
  );
}
