'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function CrearContrasenaPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [comprobando, setComprobando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [sesionDisponible, setSesionDisponible] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!activo) return;
      setSesionDisponible(Boolean(data.session));
      setComprobando(false);
    });

    const { data: suscripcion } = supabase.auth.onAuthStateChange(
      (_evento, sesion) => {
        if (!activo) return;
        setSesionDisponible(Boolean(sesion));
        setComprobando(false);
      }
    );

    return () => {
      activo = false;
      suscripcion.subscription.unsubscribe();
    };
  }, []);

  async function guardar(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (password.length < 10) {
      setError('La contraseña debe tener al menos 10 caracteres.');
      return;
    }

    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setGuardando(true);
    const { error: errorActualizacion } = await supabase.auth.updateUser({
      password,
    });

    if (errorActualizacion) {
      setError(errorActualizacion.message);
      setGuardando(false);
      return;
    }

    await supabase.auth.signOut();
    router.replace('/admin/login?password=creada');
    router.refresh();
  }

  if (comprobando) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#FFF3DF]">
        <Loader2 className="h-8 w-8 animate-spin text-[#A51F2B]" />
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#FFF3DF] px-5 py-10">
      <form
        onSubmit={guardar}
        className="w-full max-w-sm rounded-lg border border-[#4B2818]/15 bg-white p-7 shadow-[0_24px_70px_rgba(42,23,16,0.16)]"
      >
        <div className="grid h-12 w-12 place-items-center rounded-lg bg-[#A51F2B] text-white">
          <KeyRound className="h-6 w-6" />
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-wide text-[#A51F2B]">
          Maruxa ERP
        </p>
        <h1 className="mt-1 text-3xl font-black text-[#2A1710]">
          Crear contraseña
        </h1>
        <p className="mt-2 text-sm font-semibold text-[#4B2818]/70">
          Usa una contraseña temporal y exclusiva para esta cuenta.
        </p>

        {!sesionDisponible ? (
          <div className="mt-6">
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
              Este enlace ya venció o no contiene una sesión válida. Solicita una nueva invitación o restablece la contraseña.
            </p>
            <button
              type="button"
              onClick={() => router.replace('/admin/login')}
              className="mt-4 h-11 w-full rounded-md bg-[#A51F2B] font-black text-white"
            >
              Volver al inicio de sesión
            </button>
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4">
              <label className="grid gap-1.5 text-xs font-black text-[#4B2818]">
                Nueva contraseña
                <input
                  type="password"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 rounded-md border border-[#4B2818]/20 px-3 text-sm font-bold outline-none focus:border-[#A51F2B]"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-black text-[#4B2818]">
                Repetir contraseña
                <input
                  type="password"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  value={confirmacion}
                  onChange={(event) => setConfirmacion(event.target.value)}
                  className="h-11 rounded-md border border-[#4B2818]/20 px-3 text-sm font-bold outline-none focus:border-[#A51F2B]"
                />
              </label>
            </div>

            {error && (
              <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={guardando}
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#A51F2B] font-black text-white disabled:opacity-60"
            >
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
              {guardando ? 'Guardando' : 'Guardar contraseña'}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
