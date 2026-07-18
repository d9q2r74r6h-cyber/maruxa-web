'use client';

import { BadgeCheck, Clock3, Mail, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAdminSession } from '@/components/AdminSession';
import { supabase } from '@/lib/supabase';

export default function PerfilPage() {
  const { perfil, permisos, recargar } = useAdminSession();
  const [notificarWhatsapp, setNotificarWhatsapp] = useState(false);
  const [notificarEmail, setNotificarEmail] = useState(false);
  const [whatsappDestino, setWhatsappDestino] = useState('');
  const [emailDestino, setEmailDestino] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [probandoWhatsapp, setProbandoWhatsapp] = useState(false);
  const [resultadoPrueba, setResultadoPrueba] = useState('');

  useEffect(() => {
    if (!perfil) return;

    setNotificarWhatsapp(Boolean(perfil.notificar_whatsapp));
    setNotificarEmail(Boolean(perfil.notificar_email));
    setWhatsappDestino(perfil.notificacion_whatsapp || '');
    setEmailDestino(perfil.notificacion_email || '');
  }, [perfil]);

  async function guardarNotificaciones() {
    if (!perfil) return;

    if (notificarWhatsapp && !whatsappDestino.trim()) {
      alert('Ingresa el WhatsApp donde quieres recibir avisos.');
      return;
    }

    if (notificarEmail && !emailDestino.trim()) {
      alert('Ingresa el email donde quieres recibir avisos.');
      return;
    }

    setGuardando(true);

    const { error } = await supabase
      .from('perfiles_usuario')
      .update({
        notificar_whatsapp: notificarWhatsapp,
        notificar_email: notificarEmail,
        notificacion_whatsapp: whatsappDestino.trim() || null,
        notificacion_email: emailDestino.trim() || null,
      })
      .eq('id', perfil.id);

    setGuardando(false);

    if (error) {
      alert(error.message);
      return;
    }

    await recargar();
    alert('Preferencias de notificacion guardadas.');
  }

  async function probarAvisoWhatsapp() {
    setProbandoWhatsapp(true);
    setResultadoPrueba('');

    const { data: sesion } = await supabase.auth.getSession();
    const respuesta = await fetch('/api/whatsapp/probar-aviso', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sesion.session?.access_token || ''}`,
      },
    });
    const resultado = await respuesta.json();

    setProbandoWhatsapp(false);
    if (!respuesta.ok) {
      setResultadoPrueba(resultado.error || 'No se pudo enviar la prueba.');
      return;
    }

    setResultadoPrueba(
      `Meta acepto la prueba para ${resultado.destino}. Esperando confirmacion de entrega.`
    );
  }

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
            <h2 className="font-black text-[#2A1710]">Avisos de mensajes</h2>
          </div>

          <div className="grid gap-4 p-5">
            <label className="flex items-center gap-3 rounded-md border border-[#4B2818]/10 p-4 font-black text-[#2A1710]">
              <input
                type="checkbox"
                checked={notificarWhatsapp}
                onChange={(event) => setNotificarWhatsapp(event.target.checked)}
              />
              Recibir aviso por WhatsApp
            </label>

            {notificarWhatsapp && (
              <input
                value={whatsappDestino}
                onChange={(event) => setWhatsappDestino(event.target.value)}
                placeholder="569XXXXXXXX"
                className="h-11 rounded-md border border-[#4B2818]/15 px-4 font-bold"
              />
            )}

            <label className="flex items-center gap-3 rounded-md border border-[#4B2818]/10 p-4 font-black text-[#2A1710]">
              <input
                type="checkbox"
                checked={notificarEmail}
                onChange={(event) => setNotificarEmail(event.target.checked)}
              />
              Recibir aviso por email
            </label>

            {notificarEmail && (
              <input
                value={emailDestino}
                onChange={(event) => setEmailDestino(event.target.value)}
                placeholder="correo@empresa.cl"
                className="h-11 rounded-md border border-[#4B2818]/15 px-4 font-bold"
              />
            )}

            <button
              type="button"
              onClick={guardarNotificaciones}
              disabled={guardando}
              className="h-11 w-fit rounded-md bg-[#A51F2B] px-5 font-black text-white disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar avisos'}
            </button>

            {notificarWhatsapp && (
              <button
                type="button"
                onClick={probarAvisoWhatsapp}
                disabled={probandoWhatsapp || guardando}
                className="h-11 w-fit rounded-md border border-[#A51F2B] px-5 font-black text-[#A51F2B] disabled:opacity-50"
              >
                {probandoWhatsapp ? 'Enviando prueba...' : 'Probar aviso WhatsApp'}
              </button>
            )}

            {resultadoPrueba && (
              <p className="rounded-md bg-[#FFF3DF] p-3 text-sm font-bold text-[#4B2818]">
                {resultadoPrueba}
              </p>
            )}

            <p className="text-xs font-semibold text-[#4B2818]/60">
              Estos avisos se envian cuando entra un mensaje o pedido desde WhatsApp o Instagram.
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
