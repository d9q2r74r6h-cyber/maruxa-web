'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgePlus,
  Loader2,
  Save,
  ShieldCheck,
  UserRoundCog,
  UsersRound,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdminSession } from '@/components/AdminSession';
import { registrarAuditoria } from '@/lib/auditoria';

type Funcionario = {
  id: string;
  codigo: string | null;
  nombre_completo: string;
  rut: string | null;
  email: string | null;
  telefono: string | null;
  cargo: string;
  activo: boolean;
};

type Usuario = {
  id: string;
  funcionario_id: string | null;
  nombre_visible: string;
  rol: string;
  activo: boolean;
  ultimo_acceso: string | null;
  funcionarios?: { nombre_completo: string; cargo: string } | null;
};

type Modulo = {
  codigo: string;
  nombre: string;
  grupo: string;
};

type Permiso = {
  modulo_codigo: string;
  puede_ver: boolean;
  puede_crear: boolean;
  puede_editar: boolean;
  puede_eliminar: boolean;
};

const funcionarioInicial = {
  codigo: '',
  nombre_completo: '',
  rut: '',
  email: '',
  telefono: '',
  cargo: '',
};

export default function UsuariosPage() {
  const { perfil, esAdmin } = useAdminSession();
  const [vista, setVista] = useState<'funcionarios' | 'usuarios'>('funcionarios');
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState('');
  const [formFuncionario, setFormFuncionario] = useState(funcionarioInicial);
  const [invitacion, setInvitacion] = useState({
    email: '',
    nombre: '',
    funcionarioId: '',
    rol: 'operador',
  });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const funcionariosSinUsuario = useMemo(
    () =>
      funcionarios.filter(
        (funcionario) =>
          funcionario.activo &&
          !usuarios.some(
            (usuario) => usuario.funcionario_id === funcionario.id
          )
      ),
    [funcionarios, usuarios]
  );

  async function cargar() {
    if (!perfil) return;
    setCargando(true);

    const [respuestaFuncionarios, respuestaUsuarios, respuestaModulos] =
      await Promise.all([
        supabase
          .from('funcionarios')
          .select('*')
          .eq('empresa_id', perfil.empresa_id)
          .order('nombre_completo'),
        supabase
          .from('perfiles_usuario')
          .select(`
            id,
            funcionario_id,
            nombre_visible,
            rol,
            activo,
            ultimo_acceso,
            funcionarios (
              nombre_completo,
              cargo
            )
          `)
          .eq('empresa_id', perfil.empresa_id)
          .order('nombre_visible'),
        supabase
          .from('modulos_erp')
          .select('codigo, nombre, grupo')
          .eq('activo', true)
          .order('orden'),
      ]);

    setFuncionarios((respuestaFuncionarios.data || []) as Funcionario[]);
    setUsuarios(
      (respuestaUsuarios.data || []).map((usuario) => ({
        ...usuario,
        funcionarios: Array.isArray(usuario.funcionarios)
          ? usuario.funcionarios[0] || null
          : usuario.funcionarios,
      })) as Usuario[]
    );
    setModulos((respuestaModulos.data || []) as Modulo[]);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, [perfil]);

  useEffect(() => {
    async function cargarPermisos() {
      if (!usuarioSeleccionado) {
        setPermisos([]);
        return;
      }

      const { data } = await supabase
        .from('usuario_permisos')
        .select('modulo_codigo, puede_ver, puede_crear, puede_editar, puede_eliminar')
        .eq('usuario_id', usuarioSeleccionado);

      setPermisos(
        modulos.map((modulo) => {
          const actual = (data || []).find(
            (item) => item.modulo_codigo === modulo.codigo
          );
          return (
            actual || {
              modulo_codigo: modulo.codigo,
              puede_ver: false,
              puede_crear: false,
              puede_editar: false,
              puede_eliminar: false,
            }
          );
        }) as Permiso[]
      );
    }

    cargarPermisos();
  }, [modulos, usuarioSeleccionado]);

  async function crearFuncionario(event: React.FormEvent) {
    event.preventDefault();
    if (!perfil || !formFuncionario.nombre_completo || !formFuncionario.cargo)
      return;

    setGuardando(true);
    const { data, error } = await supabase
      .from('funcionarios')
      .insert({
        empresa_id: perfil.empresa_id,
        codigo: formFuncionario.codigo || null,
        nombre_completo: formFuncionario.nombre_completo,
        rut: formFuncionario.rut || null,
        email: formFuncionario.email || null,
        telefono: formFuncionario.telefono || null,
        cargo: formFuncionario.cargo,
        activo: true,
      })
      .select('id')
      .single();

    if (error) alert(error.message);
    else {
      await registrarAuditoria({
        modulo: 'usuarios',
        accion: 'crear',
        tabla: 'funcionarios',
        registroId: data.id,
        descripcion: `Funcionario creado: ${formFuncionario.nombre_completo}`,
        datosNuevos: formFuncionario,
      });
      setFormFuncionario(funcionarioInicial);
      await cargar();
    }
    setGuardando(false);
  }

  async function invitarUsuario(event: React.FormEvent) {
    event.preventDefault();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    setGuardando(true);
    const respuesta = await fetch('/api/admin/invitar-usuario', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(invitacion),
    });
    const resultado = await respuesta.json();

    if (!respuesta.ok) alert(resultado.error);
    else {
      await registrarAuditoria({
        modulo: 'usuarios',
        accion: 'invitar',
        tabla: 'perfiles_usuario',
        registroId: resultado.userId,
        descripcion: `Usuario invitado: ${invitacion.email}`,
      });
      setInvitacion({
        email: '',
        nombre: '',
        funcionarioId: '',
        rol: 'operador',
      });
      await cargar();
    }
    setGuardando(false);
  }

  async function guardarPermisos() {
    if (!usuarioSeleccionado) return;
    setGuardando(true);

    const { error } = await supabase.from('usuario_permisos').upsert(
      permisos.map((permiso) => ({
        usuario_id: usuarioSeleccionado,
        ...permiso,
      })),
      { onConflict: 'usuario_id,modulo_codigo' }
    );

    if (error) alert(error.message);
    else {
      await registrarAuditoria({
        modulo: 'usuarios',
        accion: 'permisos',
        tabla: 'usuario_permisos',
        registroId: usuarioSeleccionado,
        descripcion: 'Permisos de módulos actualizados',
        datosNuevos: permisos,
      });
      alert('Permisos guardados.');
    }
    setGuardando(false);
  }

  if (!esAdmin) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 font-black text-red-800">
        No tienes permiso para administrar usuarios.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <header>
        <p className="text-xs font-black uppercase tracking-wide text-[#A51F2B]">
          Personas y seguridad
        </p>
        <h1 className="mt-2 text-3xl font-black text-[#2A1710]">
          Usuarios y funcionarios
        </h1>
      </header>

      <div className="inline-flex rounded-lg border border-[#4B2818]/15 bg-white p-1">
        <button
          onClick={() => setVista('funcionarios')}
          className={`rounded-md px-4 py-2 text-sm font-black ${vista === 'funcionarios' ? 'bg-[#2A1710] text-white' : 'text-[#4B2818]'}`}
        >
          Funcionarios
        </button>
        <button
          onClick={() => setVista('usuarios')}
          className={`rounded-md px-4 py-2 text-sm font-black ${vista === 'usuarios' ? 'bg-[#2A1710] text-white' : 'text-[#4B2818]'}`}
        >
          Cuentas y permisos
        </button>
      </div>

      {cargando ? (
        <div className="flex justify-center p-10">
          <Loader2 className="h-6 w-6 animate-spin text-[#A51F2B]" />
        </div>
      ) : vista === 'funcionarios' ? (
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={crearFuncionario}
            className="rounded-lg border border-[#4B2818]/15 bg-white p-5"
          >
            <div className="flex items-center gap-2">
              <BadgePlus className="h-5 w-5 text-[#A51F2B]" />
              <h2 className="font-black text-[#2A1710]">Nuevo funcionario</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {[
                ['codigo', 'Código'],
                ['nombre_completo', 'Nombre completo'],
                ['rut', 'RUT'],
                ['email', 'Correo'],
                ['telefono', 'Teléfono'],
                ['cargo', 'Cargo'],
              ].map(([campo, etiqueta]) => (
                <label key={campo} className="grid gap-1 text-xs font-black text-[#4B2818]">
                  {etiqueta}
                  <input
                    required={campo === 'nombre_completo' || campo === 'cargo'}
                    value={formFuncionario[campo as keyof typeof formFuncionario]}
                    onChange={(event) =>
                      setFormFuncionario({
                        ...formFuncionario,
                        [campo]: event.target.value,
                      })
                    }
                    className="h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold outline-none focus:border-[#A51F2B]"
                  />
                </label>
              ))}
            </div>
            <button
              disabled={guardando}
              className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#A51F2B] font-black text-white"
            >
              <Save className="h-4 w-4" />
              Guardar funcionario
            </button>
          </form>

          <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
            <div className="flex items-center gap-2 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-5 py-4">
              <UsersRound className="h-5 w-5 text-[#A51F2B]" />
              <h2 className="font-black text-[#2A1710]">
                Funcionarios registrados
              </h2>
            </div>
            <div className="divide-y divide-[#4B2818]/10">
              {funcionarios.map((funcionario) => (
                <div
                  key={funcionario.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div>
                    <p className="font-black text-[#2A1710]">
                      {funcionario.nombre_completo}
                    </p>
                    <p className="text-xs font-bold uppercase text-[#A51F2B]">
                      {funcionario.cargo}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${funcionario.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {funcionario.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-5">
          <form
            onSubmit={invitarUsuario}
            className="grid gap-3 rounded-lg border border-[#4B2818]/15 bg-white p-5 md:grid-cols-4"
          >
            <input
              type="email"
              required
              placeholder="Correo del usuario"
              value={invitacion.email}
              onChange={(event) =>
                setInvitacion({ ...invitacion, email: event.target.value })
              }
              className="h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold"
            />
            <input
              required
              placeholder="Nombre visible"
              value={invitacion.nombre}
              onChange={(event) =>
                setInvitacion({ ...invitacion, nombre: event.target.value })
              }
              className="h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold"
            />
            <select
              value={invitacion.funcionarioId}
              onChange={(event) =>
                setInvitacion({
                  ...invitacion,
                  funcionarioId: event.target.value,
                })
              }
              className="h-10 rounded-md border border-[#4B2818]/20 bg-white px-3 font-bold"
            >
              <option value="">Sin funcionario vinculado</option>
              {funcionariosSinUsuario.map((funcionario) => (
                <option key={funcionario.id} value={funcionario.id}>
                  {funcionario.nombre_completo}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <select
                value={invitacion.rol}
                onChange={(event) =>
                  setInvitacion({ ...invitacion, rol: event.target.value })
                }
                className="h-10 min-w-0 flex-1 rounded-md border border-[#4B2818]/20 bg-white px-2 font-bold"
              >
                <option value="operador">Operador</option>
                <option value="supervisor">Supervisor</option>
                <option value="consulta">Consulta</option>
                <option value="administrador">Administrador</option>
              </select>
              <button className="grid h-10 w-10 place-items-center rounded-md bg-[#A51F2B] text-white" title="Invitar usuario">
                <BadgePlus className="h-4 w-4" />
              </button>
            </div>
          </form>

          <section className="grid gap-5 lg:grid-cols-[300px_1fr]">
            <div className="rounded-lg border border-[#4B2818]/15 bg-white p-3">
              <div className="flex items-center gap-2 px-2 py-2">
                <UserRoundCog className="h-5 w-5 text-[#A51F2B]" />
                <h2 className="font-black text-[#2A1710]">Usuarios</h2>
              </div>
              <div className="mt-2 space-y-1">
                {usuarios.map((usuario) => (
                  <button
                    key={usuario.id}
                    onClick={() => setUsuarioSeleccionado(usuario.id)}
                    className={`w-full rounded-md px-3 py-3 text-left transition ${usuarioSeleccionado === usuario.id ? 'bg-[#2A1710] text-white' : 'hover:bg-[#FFF3DF]'}`}
                  >
                    <p className="font-black">
                      {usuario.funcionarios?.nombre_completo ||
                        usuario.nombre_visible}
                    </p>
                    <p className="text-[10px] font-bold uppercase opacity-65">
                      {usuario.rol}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
              <div className="flex items-center justify-between border-b border-[#4B2818]/10 bg-[#FFF3DF] px-5 py-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#A51F2B]" />
                  <h2 className="font-black text-[#2A1710]">
                    Permisos por módulo
                  </h2>
                </div>
                <button
                  onClick={guardarPermisos}
                  disabled={!usuarioSeleccionado || guardando}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-[#A51F2B] px-3 text-xs font-black text-white disabled:opacity-40"
                >
                  <Save className="h-4 w-4" />
                  Guardar
                </button>
              </div>
              {!usuarioSeleccionado ? (
                <p className="p-8 text-center font-semibold text-[#4B2818]/55">
                  Selecciona un usuario.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead className="border-b border-[#4B2818]/10 text-xs uppercase text-[#4B2818]/60">
                      <tr>
                        <th className="px-4 py-3 text-left">Módulo</th>
                        {['Ver', 'Crear', 'Editar', 'Eliminar'].map((accion) => (
                          <th key={accion} className="px-3 py-3 text-center">
                            {accion}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#4B2818]/10">
                      {permisos.map((permiso) => {
                        const modulo = modulos.find(
                          (item) => item.codigo === permiso.modulo_codigo
                        );
                        return (
                          <tr key={permiso.modulo_codigo}>
                            <td className="px-4 py-3 font-black text-[#2A1710]">
                              {modulo?.nombre || permiso.modulo_codigo}
                            </td>
                            {(
                              [
                                'puede_ver',
                                'puede_crear',
                                'puede_editar',
                                'puede_eliminar',
                              ] as const
                            ).map((campo) => (
                              <td key={campo} className="px-3 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={permiso[campo]}
                                  onChange={(event) =>
                                    setPermisos((actuales) =>
                                      actuales.map((item) =>
                                        item.modulo_codigo ===
                                        permiso.modulo_codigo
                                          ? {
                                              ...item,
                                              [campo]: event.target.checked,
                                            }
                                          : item
                                      )
                                    )
                                  }
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
