'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LockKeyhole } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function ingresar(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMensaje('');
    setCargando(true);

    const { data, error: errorIngreso } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (errorIngreso) {
      const mensajes: Record<string, string> = {
        'Invalid login credentials':
          'El correo o la contraseña no coinciden con el usuario de Supabase.',
        'Email not confirmed':
          'El correo todavía no está confirmado en Supabase Authentication.',
        'User not found':
          'No existe un usuario Auth con ese correo.',
      };

      setError(mensajes[errorIngreso.message] || errorIngreso.message);
      setCargando(false);
      return;
    }

    if (!data.session) {
      setError('Supabase no devolvió una sesión válida.');
      setCargando(false);
      return;
    }

    setCargando(false);
    router.replace('/admin');
    router.refresh();
  }

  async function recuperarPassword() {
    setError('');
    setMensaje('');

    if (!email.trim()) {
      setError('Escribe primero el correo del usuario.');
      return;
    }

    setCargando(true);
    const { error: errorRecuperacion } =
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/admin/login`,
      });

    if (errorRecuperacion) {
      setError(errorRecuperacion.message);
    } else {
      setMensaje(
        'Se envió un enlace para restablecer la contraseña. Revisa también la carpeta de spam.'
      );
    }

    setCargando(false);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#FFF3DF] px-5 py-10">
      <form
        onSubmit={ingresar}
        className="w-full max-w-sm rounded-lg border border-[#4B2818]/15 bg-white p-7 shadow-[0_24px_70px_rgba(42,23,16,0.16)]"
      >
        <div className="grid h-12 w-12 place-items-center rounded-lg bg-[#A51F2B] text-white">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-wide text-[#A51F2B]">
          Maruxa ERP
        </p>
        <h1 className="mt-1 text-3xl font-black text-[#2A1710]">
          Iniciar sesión
        </h1>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-1.5 text-xs font-black text-[#4B2818]">
            Correo
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-md border border-[#4B2818]/20 px-3 text-sm font-bold outline-none focus:border-[#A51F2B]"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-black text-[#4B2818]">
            Contraseña
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 rounded-md border border-[#4B2818]/20 px-3 text-sm font-bold outline-none focus:border-[#A51F2B]"
            />
          </label>
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
            {error}
          </p>
        )}

        {mensaje && (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
            {mensaje}
          </p>
        )}

        <button
          type="submit"
          disabled={cargando}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#A51F2B] font-black text-white transition hover:bg-[#74151F] disabled:opacity-60"
        >
          {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
          {cargando ? 'Ingresando' : 'Ingresar'}
        </button>

        <button
          type="button"
          disabled={cargando}
          onClick={recuperarPassword}
          className="mt-3 w-full text-sm font-black text-[#A51F2B] hover:underline disabled:opacity-50"
        >
          Restablecer contraseña
        </button>
      </form>
    </main>
  );
}
