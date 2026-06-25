'use client';

import { useEffect, useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdminSession } from '@/components/AdminSession';

type Auditoria = {
  id: string;
  modulo: string;
  accion: string;
  tabla: string | null;
  registro_id: string | null;
  descripcion: string | null;
  created_at: string;
  usuario_id: string | null;
  nombre_usuario?: string;
};

export default function AuditoriaPage() {
  const { perfil } = useAdminSession();
  const [registros, setRegistros] = useState<Auditoria[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      if (!perfil) return;

      const { data, error } = await supabase
        .from('auditoria_erp')
        .select(`
          id,
          modulo,
          accion,
          tabla,
          registro_id,
          descripcion,
          created_at,
          usuario_id
        `)
        .eq('empresa_id', perfil.empresa_id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (!error) {
        const idsUsuarios = [
          ...new Set(
            (data || [])
              .map((registro) => registro.usuario_id)
              .filter(Boolean)
          ),
        ];
        const { data: perfilesData } = idsUsuarios.length
          ? await supabase
              .from('perfiles_usuario')
              .select('id, nombre_visible')
              .in('id', idsUsuarios)
          : { data: [] };
        const nombres = new Map(
          (perfilesData || []).map((item) => [item.id, item.nombre_visible])
        );

        setRegistros(
          (data || []).map((registro) => ({
            ...registro,
            nombre_usuario:
              nombres.get(registro.usuario_id) || 'Usuario del sistema',
          })) as Auditoria[]
        );
      }
      setCargando(false);
    }

    cargar();
  }, [perfil]);

  return (
    <div className="space-y-6 pb-12">
      <header>
        <p className="text-xs font-black uppercase tracking-wide text-[#A51F2B]">
          Seguridad y trazabilidad
        </p>
        <h1 className="mt-2 text-3xl font-black text-[#2A1710]">
          Auditoría del ERP
        </h1>
        <p className="mt-1 text-sm font-semibold text-[#4B2818]/65">
          Últimos cambios realizados en los módulos administrativos.
        </p>
      </header>

      <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
        {cargando ? (
          <div className="flex items-center justify-center gap-3 p-10 font-black text-[#4B2818]">
            <Loader2 className="h-5 w-5 animate-spin text-[#A51F2B]" />
            Cargando actividad...
          </div>
        ) : registros.length === 0 ? (
          <div className="p-10 text-center">
            <Activity className="mx-auto h-9 w-9 text-[#A51F2B]" />
            <p className="mt-3 font-black text-[#2A1710]">
              Aún no hay actividad registrada
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#4B2818]/10">
            {registros.map((registro) => (
              <article
                key={registro.id}
                className="grid gap-2 px-5 py-4 md:grid-cols-[160px_1fr_180px]"
              >
                <div>
                  <span className="rounded-full bg-[#FFF3DF] px-2 py-1 text-[10px] font-black uppercase text-[#A51F2B]">
                    {registro.modulo}
                  </span>
                  <p className="mt-2 text-xs font-black uppercase text-[#4B2818]">
                    {registro.accion}
                  </p>
                </div>
                <div>
                  <p className="font-black text-[#2A1710]">
                    {registro.descripcion ||
                      `${registro.tabla || 'Registro'} ${registro.registro_id || ''}`}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#4B2818]/60">
                    {registro.nombre_usuario}
                  </p>
                </div>
                <time className="text-xs font-bold text-[#4B2818]/55 md:text-right">
                  {new Intl.DateTimeFormat('es-CL', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(registro.created_at))}
                </time>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
