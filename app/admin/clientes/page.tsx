'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, Search, UsersRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdminSession } from '@/components/AdminSession';

type Cliente = {
  id: string;
  rut: string;
  razon_social: string;
  giro: string | null;
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean;
};

const inicial = {
  rut: '',
  razon_social: '',
  giro: '',
  direccion: '',
  comuna: '',
  ciudad: '',
  email: '',
  telefono: '',
};

export default function ClientesPage() {
  const { perfil } = useAdminSession();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [form, setForm] = useState(inicial);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    if (!perfil) return;
    setCargando(true);

    let consulta = supabase
      .from('clientes')
      .select('*')
      .eq('empresa_id', perfil.empresa_id)
      .order('razon_social');

    if (busqueda.trim()) {
      consulta = consulta.or(
        `rut.ilike.%${busqueda.trim()}%,razon_social.ilike.%${busqueda.trim()}%`
      );
    }

    const { data, error } = await consulta;
    if (error) alert(error.message);
    else setClientes((data || []) as Cliente[]);
    setCargando(false);
  }

  useEffect(() => {
    const temporizador = window.setTimeout(cargar, 250);
    return () => window.clearTimeout(temporizador);
  }, [busqueda, perfil]);

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    if (!perfil) return;
    setGuardando(true);

    const { error } = await supabase.from('clientes').insert({
      empresa_id: perfil.empresa_id,
      rut: form.rut.trim(),
      razon_social: form.razon_social.trim(),
      giro: form.giro.trim() || null,
      direccion: form.direccion.trim() || null,
      comuna: form.comuna.trim() || null,
      ciudad: form.ciudad.trim() || null,
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      activo: true,
    });

    if (error) alert(error.message);
    else {
      setForm(inicial);
      await cargar();
    }
    setGuardando(false);
  }

  return (
    <div className="space-y-6 pb-12">
      <header>
        <p className="text-xs font-black uppercase tracking-wide text-[#A51F2B]">
          Comercial
        </p>
        <h1 className="mt-2 text-3xl font-black text-[#2A1710]">Clientes</h1>
        <p className="mt-1 text-sm font-semibold text-[#4B2818]/65">
          Receptores para facturas, guías y otros documentos tributarios.
        </p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <form
          onSubmit={guardar}
          className="rounded-lg border border-[#4B2818]/15 bg-white p-5"
        >
          <h2 className="font-black text-[#2A1710]">Nuevo cliente</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {[
              ['rut', 'RUT'],
              ['razon_social', 'Razón social'],
              ['giro', 'Giro'],
              ['direccion', 'Dirección'],
              ['comuna', 'Comuna'],
              ['ciudad', 'Ciudad'],
              ['email', 'Correo'],
              ['telefono', 'Teléfono'],
            ].map(([campo, etiqueta]) => (
              <label
                key={campo}
                className="grid gap-1 text-xs font-black text-[#4B2818]"
              >
                {etiqueta}
                <input
                  required={campo === 'rut' || campo === 'razon_social'}
                  value={form[campo as keyof typeof form]}
                  onChange={(event) =>
                    setForm({ ...form, [campo]: event.target.value })
                  }
                  className="h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold outline-none focus:border-[#A51F2B]"
                />
              </label>
            ))}
          </div>
          <button
            disabled={guardando}
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#A51F2B] font-black text-white disabled:opacity-60"
          >
            {guardando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar cliente
          </button>
        </form>

        <div className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
          <div className="flex flex-col justify-between gap-3 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-5 py-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-[#A51F2B]" />
              <h2 className="font-black text-[#2A1710]">
                Clientes registrados
              </h2>
            </div>
            <label className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#4B2818]/45" />
              <input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar RUT o razón social"
                className="h-9 w-full rounded-md border border-[#4B2818]/15 bg-white pl-9 pr-3 text-sm font-bold outline-none sm:w-64"
              />
            </label>
          </div>
          {cargando ? (
            <div className="flex justify-center p-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#A51F2B]" />
            </div>
          ) : clientes.length === 0 ? (
            <p className="p-10 text-center font-semibold text-[#4B2818]/55">
              No se encontraron clientes.
            </p>
          ) : (
            <div className="divide-y divide-[#4B2818]/10">
              {clientes.map((cliente) => (
                <article
                  key={cliente.id}
                  className="grid gap-2 px-5 py-4 md:grid-cols-[160px_1fr_180px]"
                >
                  <p className="font-black text-[#A51F2B]">{cliente.rut}</p>
                  <div>
                    <p className="font-black text-[#2A1710]">
                      {cliente.razon_social}
                    </p>
                    <p className="text-xs font-semibold text-[#4B2818]/60">
                      {cliente.giro || 'Sin giro'} ·{' '}
                      {[cliente.comuna, cliente.ciudad]
                        .filter(Boolean)
                        .join(', ') || 'Sin ubicación'}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-[#4B2818]/60 md:text-right">
                    {cliente.email || cliente.telefono || '-'}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
