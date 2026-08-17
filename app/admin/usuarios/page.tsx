'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BadgePlus,
  Mail,
  Pencil,
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
  nombre_corto: string | null;
  rut: string | null;
  email: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  dia_descanso: string | null;
  cargo: string;
  activo: boolean;
  trabaja_comision: boolean;
  porcentaje_comision: number;
  recibe_dominical: boolean;
  ciclo_dominical: 'impar' | 'par' | null;
  funcionario_cargos?: { cargo_id: string; cargos_empresa?: { id: string; nombre: string } | { id: string; nombre: string }[] | null }[];
};
type ModalidadPago = 'diaria' | 'mensual' | 'panadero';
type CargoEmpresa = { id: string; nombre: string; activo: boolean; modalidad_pago: ModalidadPago; remuneracion: number };

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
  nombre_corto: '',
  rut: '',
  email: '',
  telefono: '',
  fecha_nacimiento: '',
  dia_descanso: '',
  cargo: '',
  cargo_ids: [] as string[],
  trabaja_comision: false,
  porcentaje_comision: '3',
};

function fechaCorta(fecha: string | null) {
  if (!fecha) return null;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (!anio || !mes || !dia) return null;

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'long',
  }).format(new Date(anio, mes - 1, dia));
}

const formatoPesos = (valor: number) => valor ? `$${Math.round(valor).toLocaleString('es-CL')}` : '';
const leerPesos = (valor: string) => Number(valor.replace(/[^0-9-]/g, '')) || 0;
const nombreCargoRelacionado = (valor: { nombre: string } | { nombre: string }[] | null | undefined) => Array.isArray(valor) ? valor[0]?.nombre || '' : valor?.nombre || '';

export default function UsuariosPage() {
  const { perfil, esAdmin } = useAdminSession();
  const [vista, setVista] = useState<'funcionarios' | 'usuarios'>('funcionarios');
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [cargosEmpresa, setCargosEmpresa] = useState<CargoEmpresa[]>([]);
  const [nuevoCargo, setNuevoCargo] = useState({ nombre: '', modalidad_pago: 'mensual' as ModalidadPago, remuneracion: 0 });
  const [funcionarioEditando, setFuncionarioEditando] = useState<(Funcionario & { cargo_ids: string[] }) | null>(null);
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

    const [respuestaFuncionarios, respuestaUsuarios, respuestaModulos, respuestaCargos] =
      await Promise.all([
        supabase
          .from('funcionarios')
          .select('*, funcionario_cargos(cargo_id,cargos_empresa(id,nombre))')
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
        supabase.from('cargos_empresa').select('id,nombre,activo,modalidad_pago,remuneracion').eq('empresa_id', perfil.empresa_id).eq('activo', true).order('nombre'),
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
    setCargosEmpresa((respuestaCargos.data || []) as CargoEmpresa[]);
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
    if (!perfil || !formFuncionario.nombre_completo || !formFuncionario.cargo_ids.length)
      return;

    setGuardando(true);
    const { data, error } = await supabase
      .from('funcionarios')
      .insert({
        empresa_id: perfil.empresa_id,
        codigo: formFuncionario.codigo || null,
        nombre_completo: formFuncionario.nombre_completo,
        nombre_corto: formFuncionario.nombre_corto.trim() || formFuncionario.nombre_completo.trim().split(/\s+/)[0],
        rut: formFuncionario.rut || null,
        email: formFuncionario.email || null,
        telefono: formFuncionario.telefono || null,
        fecha_nacimiento: formFuncionario.fecha_nacimiento || null,
        dia_descanso: formFuncionario.dia_descanso || null,
        cargo: cargosEmpresa.find((cargo) => cargo.id === formFuncionario.cargo_ids[0])?.nombre || 'Funcionario',
        trabaja_comision: formFuncionario.trabaja_comision,
        porcentaje_comision: Number(formFuncionario.porcentaje_comision || 0),
        activo: true,
      })
      .select('id')
      .single();

    if (error) alert(error.message);
    else {
      const { error: errorCargos } = await supabase.from('funcionario_cargos').insert(formFuncionario.cargo_ids.map((cargo_id) => ({ funcionario_id: data.id, cargo_id })));
      if (errorCargos) { setGuardando(false); return alert(errorCargos.message); }
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

  async function crearCargo() {
    if (!perfil || !nuevoCargo.nombre.trim()) return;
    const configuracion_pago = nuevoCargo.modalidad_pago === 'panadero' ? { normal: { casa: { batea: 26800, cocedor: 25700, oficial: 22500 }, externo: { batea: 31300, cocedor: 29000, oficial: 26000 } }, festivo: { casa: { batea: 36600, cocedor: 35000, oficial: 30000 }, externo: { batea: 43400, cocedor: 41400, oficial: 35400 } }, demasia_normal_qq: 8000, demasia_festivo_qq: 12000 } : {};
    const { error } = await supabase.from('cargos_empresa').insert({ empresa_id: perfil.empresa_id, nombre: nuevoCargo.nombre.trim(), modalidad_pago: nuevoCargo.modalidad_pago, remuneracion: nuevoCargo.modalidad_pago === 'panadero' ? 0 : nuevoCargo.remuneracion, configuracion_pago });
    if (error) return alert(error.message); setNuevoCargo({ nombre: '', modalidad_pago: 'mensual', remuneracion: 0 }); await cargar();
  }

  async function actualizarCargo(cargo: CargoEmpresa, cambios: Partial<CargoEmpresa>) {
    const actualizado = { ...cargo, ...cambios };
    const { error } = await supabase.from('cargos_empresa').update({ nombre: actualizado.nombre, modalidad_pago: actualizado.modalidad_pago, remuneracion: actualizado.modalidad_pago === 'panadero' ? 0 : actualizado.remuneracion }).eq('id', cargo.id);
    if (error) return alert(error.message); setCargosEmpresa((lista) => lista.map((item) => item.id === cargo.id ? actualizado : item));
  }

  async function alternarCargo(funcionario: Funcionario, cargoId: string, activo: boolean) {
    const consulta = activo ? supabase.from('funcionario_cargos').insert({ funcionario_id: funcionario.id, cargo_id: cargoId }) : supabase.from('funcionario_cargos').delete().eq('funcionario_id', funcionario.id).eq('cargo_id', cargoId);
    const { error } = await consulta; if (error) return alert(error.message); await cargar();
  }

  function abrirEdicion(funcionario: Funcionario) {
    setFuncionarioEditando({ ...funcionario, cargo_ids: (funcionario.funcionario_cargos || []).map((item) => item.cargo_id) });
  }

  async function guardarFuncionarioEditado(event: React.FormEvent) {
    event.preventDefault();
    if (!funcionarioEditando?.nombre_completo.trim() || !funcionarioEditando.cargo_ids.length) return alert('Ingresa el nombre y al menos un cargo.');
    setGuardando(true);
    const cargoPrincipal = cargosEmpresa.find((cargo) => cargo.id === funcionarioEditando.cargo_ids[0])?.nombre || 'Funcionario';
    const { error } = await supabase.from('funcionarios').update({ codigo: funcionarioEditando.codigo || null, nombre_completo: funcionarioEditando.nombre_completo.trim(), nombre_corto: funcionarioEditando.nombre_corto?.trim() || funcionarioEditando.nombre_completo.trim().split(/\s+/)[0], rut: funcionarioEditando.rut || null, email: funcionarioEditando.email || null, telefono: funcionarioEditando.telefono || null, fecha_nacimiento: funcionarioEditando.fecha_nacimiento || null, dia_descanso: funcionarioEditando.dia_descanso || null, cargo: cargoPrincipal, activo: funcionarioEditando.activo, trabaja_comision: funcionarioEditando.trabaja_comision, porcentaje_comision: funcionarioEditando.porcentaje_comision || 0 }).eq('id', funcionarioEditando.id);
    if (!error) {
      const { error: errorBorrar } = await supabase.from('funcionario_cargos').delete().eq('funcionario_id', funcionarioEditando.id);
      const { error: errorInsertar } = errorBorrar ? { error: errorBorrar } : await supabase.from('funcionario_cargos').insert(funcionarioEditando.cargo_ids.map((cargo_id) => ({ funcionario_id: funcionarioEditando.id, cargo_id })));
      if (errorInsertar) { setGuardando(false); return alert(errorInsertar.message); }
    }
    setGuardando(false); if (error) return alert(error.message);
    await registrarAuditoria({ modulo: 'usuarios', accion: 'editar', tabla: 'funcionarios', registroId: funcionarioEditando.id, descripcion: `Funcionario actualizado: ${funcionarioEditando.nombre_completo}` });
    setFuncionarioEditando(null); await cargar(); alert('Funcionario actualizado.');
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

  async function reenviarAcceso(usuario: Usuario) {
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
      body: JSON.stringify({ userId: usuario.id }),
    });
    const resultado = await respuesta.json();
    setGuardando(false);

    if (!respuesta.ok) return alert(resultado.error);

    await registrarAuditoria({
      modulo: 'usuarios',
      accion: 'invitar',
      tabla: 'perfiles_usuario',
      registroId: usuario.id,
      descripcion: `Acceso reenviado: ${usuario.nombre_visible}`,
    });
    alert(`Correo de acceso reenviado a ${usuario.nombre_visible}.`);
  }

  async function actualizarComision(
    funcionario: Funcionario,
    trabajaComision: boolean,
    porcentaje = funcionario.porcentaje_comision || 3
  ) {
    const { error } = await supabase
      .from('funcionarios')
      .update({
        trabaja_comision: trabajaComision,
        porcentaje_comision: porcentaje,
      })
      .eq('id', funcionario.id);
    if (error) {
      alert(error.message);
      return;
    }
    setFuncionarios((actuales) =>
      actuales.map((item) =>
        item.id === funcionario.id
          ? {
              ...item,
              trabaja_comision: trabajaComision,
              porcentaje_comision: porcentaje,
            }
          : item
      )
    );
  }

  async function actualizarDatosBreves(funcionario: Funcionario, cambios: { nombre_corto?: string; dia_descanso?: string | null; recibe_dominical?: boolean; ciclo_dominical?: 'impar' | 'par' | null }) {
    const { error } = await supabase.from('funcionarios').update(cambios).eq('id', funcionario.id);
    if (error) return alert(error.message);
    setFuncionarios((lista) => lista.map((item) => item.id === funcionario.id ? { ...item, ...cambios } : item));
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
      {funcionarioEditando && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4"><form onSubmit={guardarFuncionarioEditado} className="my-6 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase text-[#A51F2B]">Funcionario</p><h2 className="text-2xl font-black text-[#2A1710]">Editar datos</h2></div><button type="button" onClick={() => setFuncionarioEditando(null)} className="rounded-md px-3 py-2 font-black">Cerrar</button></div><div className="mt-5 grid gap-3 md:grid-cols-2">{([['codigo','Código','text'],['nombre_completo','Nombre completo','text'],['rut','RUT','text'],['email','Correo','email'],['telefono','Teléfono','text'],['fecha_nacimiento','Fecha de nacimiento','date']] as const).map(([campo,etiqueta,tipo]) => <label key={campo} className="grid gap-1 text-xs font-black text-[#4B2818]">{etiqueta}<input type={tipo} required={campo==='nombre_completo'} value={funcionarioEditando[campo] || ''} onChange={(event) => setFuncionarioEditando({ ...funcionarioEditando, [campo]: event.target.value })} className="h-11 rounded-md border px-3 text-sm font-bold" /></label>)}</div><fieldset className="mt-4 rounded-lg border p-4"><legend className="px-2 text-sm font-black">Cargos</legend><div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">{cargosEmpresa.map((cargo) => <label key={cargo.id} className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={funcionarioEditando.cargo_ids.includes(cargo.id)} onChange={(event) => setFuncionarioEditando({ ...funcionarioEditando, cargo_ids: event.target.checked ? [...funcionarioEditando.cargo_ids,cargo.id] : funcionarioEditando.cargo_ids.filter((id) => id!==cargo.id) })} />{cargo.nombre}</label>)}</div></fieldset><div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="flex h-11 items-center gap-2 rounded-md border px-3 text-sm font-black"><input type="checkbox" checked={funcionarioEditando.activo} onChange={(event) => setFuncionarioEditando({ ...funcionarioEditando, activo: event.target.checked })} />Funcionario activo</label><label className="flex h-11 items-center gap-2 rounded-md border px-3 text-sm font-black"><input type="checkbox" checked={funcionarioEditando.trabaja_comision} onChange={(event) => setFuncionarioEditando({ ...funcionarioEditando, trabaja_comision: event.target.checked })} />Trabaja a comisión</label>{funcionarioEditando.trabaja_comision && <label className="grid gap-1 text-xs font-black">Comisión %<input type="number" min="0" step="0.1" value={funcionarioEditando.porcentaje_comision || 0} onChange={(event) => setFuncionarioEditando({ ...funcionarioEditando, porcentaje_comision: Number(event.target.value) })} className="h-11 rounded-md border px-3 text-right text-sm font-black" /></label>}</div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setFuncionarioEditando(null)} className="h-11 rounded-md border px-5 font-black">Cancelar</button><button disabled={guardando} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#A51F2B] px-6 font-black text-white"><Save className="h-4 w-4" />Guardar cambios</button></div></form></div>}
      <style jsx global>{`@media (min-width:640px){.fixed.inset-0 form > div.mt-4.grid{align-items:end}}`}</style>
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
        <div className="space-y-5">
          <section className="rounded-lg border border-[#4B2818]/15 bg-white p-5"><h2 className="font-black text-[#2A1710]">Cargos y remuneraciones de la empresa</h2><p className="mt-1 text-xs font-bold text-[#4B2818]/60">La remuneración se configura en el cargo. Panadero utiliza su tabla especial por función, origen y tipo de día.</p><div className="mt-3 grid gap-2 md:grid-cols-[1fr_180px_160px_auto]"><input value={nuevoCargo.nombre} onChange={(event) => setNuevoCargo({ ...nuevoCargo, nombre: event.target.value })} placeholder="Nombre del cargo" className="h-10 min-w-0 rounded-md border px-3 font-bold" /><select value={nuevoCargo.modalidad_pago} onChange={(event) => setNuevoCargo({ ...nuevoCargo, modalidad_pago: event.target.value as ModalidadPago })} className="h-10 rounded-md border bg-white px-2 text-sm font-bold"><option value="mensual">Pago mensual</option><option value="diaria">Pago por día</option><option value="panadero">Especial Panadero</option></select>{nuevoCargo.modalidad_pago !== 'panadero' ? <input type="text" inputMode="numeric" value={formatoPesos(nuevoCargo.remuneracion)} onChange={(event) => setNuevoCargo({ ...nuevoCargo, remuneracion: Math.max(0, leerPesos(event.target.value)) })} placeholder="$0" className="h-10 rounded-md border px-3 text-right font-black" /> : <div className="grid h-10 place-items-center rounded-md bg-[#FFF3DF] text-xs font-black text-[#A51F2B]">Tabla especial</div>}<button type="button" onClick={() => void crearCargo()} className="rounded-md bg-[#2A1710] px-4 text-sm font-black text-white">Agregar cargo</button></div><div className="mt-4 grid gap-2 md:grid-cols-2">{cargosEmpresa.map((cargo) => <div key={cargo.id} className="grid grid-cols-[1fr_145px_120px] items-center gap-2 rounded-lg border bg-[#FFF9EF] p-2"><input value={cargo.nombre} onChange={(event) => setCargosEmpresa((lista) => lista.map((item) => item.id === cargo.id ? { ...item, nombre: event.target.value } : item))} onBlur={(event) => void actualizarCargo(cargo,{ nombre:event.target.value })} className="h-9 min-w-0 rounded border bg-white px-2 text-sm font-black" /><select value={cargo.modalidad_pago} onChange={(event) => void actualizarCargo(cargo,{ modalidad_pago:event.target.value as ModalidadPago })} className="h-9 rounded border bg-white px-1 text-xs font-bold"><option value="mensual">Mensual</option><option value="diaria">Por día</option><option value="panadero">Esp. Panadero</option></select>{cargo.modalidad_pago === 'panadero' ? <span className="text-center text-xs font-black text-[#A51F2B]">Tabla especial</span> : <input type="text" inputMode="numeric" value={formatoPesos(cargo.remuneracion)} onChange={(event) => setCargosEmpresa((lista) => lista.map((item) => item.id === cargo.id ? { ...item, remuneracion:Math.max(0,leerPesos(event.target.value)) } : item))} onBlur={(event) => void actualizarCargo(cargo,{ remuneracion:Math.max(0,leerPesos(event.target.value)) })} className="h-9 rounded border bg-white px-2 text-right text-xs font-black" />}</div>)}</div></section>
        <Link href="/admin/usuarios/remuneraciones-panaderos" className="inline-flex h-11 items-center rounded-md border border-[#A51F2B] bg-white px-5 text-sm font-black text-[#A51F2B]">Editar tabla especial de panaderos</Link>
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
                ['nombre_corto', 'Nombre corto'],
                ['rut', 'RUT'],
                ['email', 'Correo'],
                ['telefono', 'Teléfono'],
                ['fecha_nacimiento', 'Fecha de nacimiento'],
              ].map(([campo, etiqueta]) => (
                <label key={campo} className="grid gap-1 text-xs font-black text-[#4B2818]">
                  {etiqueta}
                  <input
                    type={campo === 'fecha_nacimiento' ? 'date' : 'text'}
                    required={campo === 'nombre_completo'}
                    value={String(formFuncionario[campo as keyof typeof formFuncionario] ?? '')}
                    onChange={(event) => setFormFuncionario({ ...formFuncionario, [campo]: event.target.value, ...(campo === 'nombre_completo' && !formFuncionario.nombre_corto ? { nombre_corto: event.target.value.trim().split(/\s+/)[0] } : {}) })}
                    className="h-10 rounded-md border border-[#4B2818]/20 px-3 font-bold outline-none focus:border-[#A51F2B]"
                  />
                </label>
              ))}
              <label className="grid gap-1 text-xs font-black text-[#4B2818]">Día de descanso<select value={formFuncionario.dia_descanso} onChange={(event) => setFormFuncionario({ ...formFuncionario, dia_descanso: event.target.value })} className="h-10 rounded-md border bg-white px-3 font-bold"><option value="">Sin asignar</option>{['lunes','martes','miércoles','jueves','viernes','sábado','domingo'].map((dia) => <option key={dia} value={dia} className="capitalize">{dia}</option>)}</select></label>
              <fieldset className="rounded-md border border-[#4B2818]/15 p-3"><legend className="px-1 text-xs font-black text-[#4B2818]">Cargos</legend><div className="grid gap-2">{cargosEmpresa.map((cargo) => <label key={cargo.id} className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={formFuncionario.cargo_ids.includes(cargo.id)} onChange={(event) => setFormFuncionario({ ...formFuncionario, cargo_ids: event.target.checked ? [...formFuncionario.cargo_ids, cargo.id] : formFuncionario.cargo_ids.filter((id) => id !== cargo.id) })} className="accent-[#A51F2B]" />{cargo.nombre}</label>)}</div></fieldset>
              <label className="flex items-center gap-3 rounded-md border border-[#4B2818]/15 bg-[#FFF3DF] px-3 py-2 text-sm font-black text-[#4B2818]">
                <input type="checkbox" checked={formFuncionario.trabaja_comision} onChange={(event) => setFormFuncionario({ ...formFuncionario, trabaja_comision: event.target.checked })} className="h-5 w-5 accent-[#A51F2B]" />
                Trabaja a comisión
              </label>
              {formFuncionario.trabaja_comision && (
                <label className="grid gap-1 text-xs font-black text-[#4B2818]">Porcentaje de comisión
                  <span className="flex h-10 items-center rounded-md border border-[#4B2818]/20 bg-white pr-3 focus-within:border-[#A51F2B]">
                    <input type="number" step="0.1" min="0" value={formFuncionario.porcentaje_comision} onChange={(event) => setFormFuncionario({ ...formFuncionario, porcentaje_comision: event.target.value })} className="h-full min-w-0 flex-1 rounded-md px-3 text-right font-bold outline-none" />
                    <span className="ml-1 text-sm font-black text-[#A51F2B]">%</span>
                  </span>
                </label>
              )}
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
            <div className="overflow-x-auto">
              <div className="grid min-w-[895px] grid-cols-[170px_95px_110px_145px_105px_80px_65px_75px] gap-1 border-b border-[#4B2818]/15 bg-[#2A1710] px-2 py-3 text-[10px] font-black uppercase tracking-wide text-white">
                <span>Funcionario</span><span>Nombre corto</span><span>Descanso</span><span>Cargos</span><span>Dominical</span><span>Comisión</span><span>Estado</span><span></span>
              </div>
              {funcionarios.map((funcionario) => (
                <div
                  key={funcionario.id}
                  className="grid min-w-[895px] grid-cols-[170px_95px_110px_145px_105px_80px_65px_75px] items-start gap-1 border-b border-[#4B2818]/10 px-2 py-3 text-xs hover:bg-[#FFF9EF]"
                >
                  <div className="min-w-0"><p className="truncate font-black text-[#2A1710]" title={funcionario.nombre_completo}>{funcionario.nombre_completo}</p>
                    {fechaCorta(funcionario.fecha_nacimiento) && (
                      <p className="mt-1 text-[10px] font-semibold text-[#4B2818]/60">Cumpleaños: {fechaCorta(funcionario.fecha_nacimiento)}</p>)}</div>
                  <input value={funcionario.nombre_corto || ''} onChange={(event) => setFuncionarios((lista) => lista.map((item) => item.id === funcionario.id ? { ...item, nombre_corto: event.target.value } : item))} onBlur={(event) => void actualizarDatosBreves(funcionario,{ nombre_corto:event.target.value.trim() || funcionario.nombre_completo.split(/\s+/)[0] })} className="h-8 min-w-0 rounded border px-2 font-bold" />
                  <select value={funcionario.dia_descanso || ''} onChange={(event) => void actualizarDatosBreves(funcionario,{ dia_descanso:event.target.value || null })} className="h-8 min-w-0 rounded border bg-white px-2 font-bold"><option value="">Sin asignar</option>{['lunes','martes','miércoles','jueves','viernes','sábado','domingo'].map((dia) => <option key={dia} value={dia}>{dia}</option>)}</select>
                  <div className="min-w-0"><div className="flex flex-wrap gap-1">{(funcionario.funcionario_cargos || []).map((relacion) => <span key={relacion.cargo_id} className="rounded-full bg-[#FFF3DF] px-2 py-1 text-[9px] font-black uppercase text-[#A51F2B]">{nombreCargoRelacionado(relacion.cargos_empresa)}</span>)}</div><details className="mt-1"><summary className="cursor-pointer text-[10px] font-black text-[#4B2818]/65">Editar cargos</summary><div className="absolute z-10 mt-1 grid rounded border bg-white p-2 shadow-lg">{cargosEmpresa.map((cargo) => { const asignado=(funcionario.funcionario_cargos || []).some((r) => r.cargo_id===cargo.id); return <label key={cargo.id} className="flex items-center gap-2 whitespace-nowrap py-1 text-[10px] font-bold"><input type="checkbox" checked={asignado} onChange={(event) => void alternarCargo(funcionario,cargo.id,event.target.checked)} />{cargo.nombre}</label>; })}</div></details></div>
                  <div className="space-y-1"><label className="flex h-8 items-center gap-1 rounded border px-1.5 text-[9px] font-black uppercase"><input type="checkbox" checked={funcionario.recibe_dominical || false} onChange={(event)=>void actualizarDatosBreves(funcionario,{recibe_dominical:event.target.checked,ciclo_dominical:event.target.checked?(funcionario.ciclo_dominical||'impar'):null})}/>Recibe</label>{funcionario.recibe_dominical&&<select value={funcionario.ciclo_dominical||'impar'} onChange={(event)=>void actualizarDatosBreves(funcionario,{ciclo_dominical:event.target.value as 'impar'|'par'})} className="h-7 w-full rounded border bg-white px-1 text-[9px] font-bold"><option value="impar">Impares</option><option value="par">Pares</option></select>}</div>
                  <div className="space-y-1"><label className="flex h-8 items-center gap-1 text-[10px] font-black"><input type="checkbox" checked={funcionario.trabaja_comision || false} onChange={(event) => void actualizarComision(funcionario, event.target.checked)} />Sí</label>{funcionario.trabaja_comision&&<span className="flex h-7 items-center rounded border pr-1"><input type="number" step="0.1" min="0" value={funcionario.porcentaje_comision || 3} onChange={(event) => setFuncionarios((actuales) => actuales.map((item) => item.id === funcionario.id ? { ...item, porcentaje_comision: Number(event.target.value) } : item))} onBlur={(event) => void actualizarComision(funcionario,true,Number(event.target.value))} className="min-w-0 flex-1 px-1 text-right text-[10px] font-black"/><span>%</span></span>}</div>
                  <span className={`mt-1 rounded-full px-2 py-1 text-center text-[9px] font-black uppercase ${funcionario.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{funcionario.activo ? 'Activo' : 'Inactivo'}</span>
                  <button type="button" onClick={() => abrirEdicion(funcionario)} className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-[#A51F2B]/30 px-1 text-[9px] font-black text-[#A51F2B]"><Pencil className="h-3.5 w-3.5" />Editar</button>
                </div>
              ))}
            </div>
          </section>
        </div></div>
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
                  <div
                    key={usuario.id}
                    className={`flex items-center gap-1 rounded-md transition ${usuarioSeleccionado === usuario.id ? 'bg-[#2A1710] text-white' : 'hover:bg-[#FFF3DF]'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setUsuarioSeleccionado(usuario.id)}
                      className="min-w-0 flex-1 px-3 py-3 text-left"
                    >
                      <p className="truncate font-black">
                        {usuario.funcionarios?.nombre_completo ||
                          usuario.nombre_visible}
                      </p>
                      <p className="text-[10px] font-bold uppercase opacity-65">
                        {usuario.rol}
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={guardando}
                      onClick={() => void reenviarAcceso(usuario)}
                      className="mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-current/20 disabled:opacity-40"
                      title={`Reenviar acceso a ${usuario.nombre_visible}`}
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                  </div>
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
