'use client';

import { useEffect, useState } from 'react';
import { Building2, Loader2, Save, ShieldAlert, Trash2, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdminSession } from '@/components/AdminSession';

type Mayorista = {
  id: string; razon_social: string; rut: string; giro: string | null; contacto_nombre: string;
  email: string; telefono: string; empresa_direccion: string; empresa_comuna: string;
  empresa_ciudad: string; empresa_region: string; empresa_pais: string | null;
  despacho_a_empresa: boolean; despacho_direccion: string | null; despacho_comuna: string | null;
  despacho_ciudad: string | null; despacho_region: string | null; despacho_pais: string | null;
  despacho_referencia: string | null; volumen_estimado: string | null;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido'; descuento_porcentaje: number;
  pedido_minimo: number; despacho_habilitado: boolean; condicion_pago: string | null;
  observaciones_internas: string | null; created_at: string;
};

type EventoSeguridad = {
  id: number; created_at: string; motivo: string; ip_hash: string | null; user_agent: string | null;
  detalles: {
    ubicacion_conexion?: { pais?: string | null; region?: string | null; ciudad?: string | null };
    ubicacion_declarada?: { pais?: string | null; region?: string | null; comuna?: string | null };
  } | null;
};

export default function MayoristasAdminPage() {
  const { perfil } = useAdminSession();
  const [items, setItems] = useState<Mayorista[]>([]);
  const [eventos, setEventos] = useState<EventoSeguridad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState('');
  const [limpiando, setLimpiando] = useState(false);

  async function cargar() {
    if (!perfil) return;
    setCargando(true);
    const [clientesResp, eventosResp] = await Promise.all([
      supabase.from('clientes_mayoristas').select('*').eq('empresa_id', perfil.empresa_id).order('created_at', { ascending: false }),
      supabase.from('eventos_seguridad').select('id,created_at,motivo,ip_hash,user_agent,detalles').eq('empresa_id', perfil.empresa_id).eq('tipo', 'formulario_automatizado').order('created_at', { ascending: false }).limit(50),
    ]);
    if (clientesResp.error) alert(clientesResp.error.message);
    setItems((clientesResp.data || []) as Mayorista[]);
    // Si aún no se ejecutó la migración, los clientes siguen cargando normalmente.
    setEventos((eventosResp.data || []) as EventoSeguridad[]);
    setCargando(false);
  }

  useEffect(() => { void cargar(); }, [perfil]);

  function cambiar(id: string, cambios: Partial<Mayorista>) {
    setItems((actuales) => actuales.map((item) => item.id === id ? { ...item, ...cambios } : item));
  }

  async function guardar(item: Mayorista) {
    setGuardando(item.id);
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const respuesta = await fetch('/api/admin/mayoristas/actualizar', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(item) });
    const datos = await respuesta.json();
    setGuardando('');
    if (!respuesta.ok) return alert(datos.error || 'No se pudo guardar.');
    await cargar();
  }

  async function limpiarAutomatizadas() {
    if (!confirm('Se eliminarán únicamente las solicitudes pendientes detectadas como automatizadas y sus cuentas de acceso. ¿Continuar?')) return;
    setLimpiando(true);
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const respuesta = await fetch('/api/admin/mayoristas/limpiar-automatizadas', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const datos = await respuesta.json().catch(() => ({}));
    setLimpiando(false);
    if (!respuesta.ok) return alert(datos.error || 'No fue posible realizar la limpieza.');
    alert(`Se eliminaron ${datos.eliminadas || 0} solicitudes automatizadas.`);
    await cargar();
  }

  if (cargando) return <div className="grid min-h-64 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#A51F2B]" /></div>;

  return <div className="space-y-5 pb-12">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-[#A51F2B]">Comercial</p><h1 className="mt-1 text-3xl font-black text-[#2A1710]">Clientes mayoristas</h1><p className="mt-2 text-sm font-bold text-[#4B2818]/65">Valida solicitudes y configura precios, mínimos y despacho.</p></div><button type="button" onClick={() => void limpiarAutomatizadas()} disabled={limpiando} className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-300 bg-white px-4 text-sm font-black text-red-700 disabled:opacity-50">{limpiando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Eliminar automatizadas</button></header>

    {eventos.length > 0 && <section className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-red-50 px-5 py-4"><ShieldAlert className="h-5 w-5 text-red-700" /><div><h2 className="font-black text-red-950">Intentos bloqueados</h2><p className="text-xs font-bold text-red-900/60">Últimos 50 envíos automatizados detectados.</p></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-[#2A1710] text-xs uppercase text-white"><tr><th className="px-4 py-3 text-left">Fecha</th><th className="px-4 py-3 text-left">Motivo</th><th className="px-4 py-3 text-left">Origen estimado</th><th className="px-4 py-3 text-left">Datos declarados</th><th className="px-4 py-3 text-left">IP identificada</th><th className="px-4 py-3 text-left">Dispositivo</th></tr></thead>
        <tbody className="divide-y">{eventos.map((evento) => { const conexion = evento.detalles?.ubicacion_conexion; const declarada = evento.detalles?.ubicacion_declarada; return <tr key={evento.id}><td className="whitespace-nowrap px-4 py-3 font-bold">{new Date(evento.created_at).toLocaleString('es-CL')}</td><td className="px-4 py-3 font-black text-red-700">{evento.motivo.replaceAll('_', ' ')}</td><td className="px-4 py-3">{[conexion?.ciudad, conexion?.region, conexion?.pais].filter(Boolean).join(', ') || 'No disponible'}</td><td className="px-4 py-3">{[declarada?.comuna, declarada?.region, declarada?.pais].filter(Boolean).join(', ') || 'No informado'}</td><td className="px-4 py-3 font-mono text-xs" title={evento.ip_hash || ''}>{evento.ip_hash ? evento.ip_hash.slice(0, 12) : 'No disponible'}</td><td className="max-w-72 truncate px-4 py-3" title={evento.user_agent || ''}>{evento.user_agent || 'No disponible'}</td></tr>; })}</tbody>
      </table></div>
    </section>}

    {items.length === 0 ? <div className="rounded-2xl border border-dashed bg-white p-10 text-center font-bold">No hay solicitudes mayoristas.</div> : <div className="space-y-4">{items.map((item) => <article key={item.id} className="rounded-2xl border border-[#4B2818]/15 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-[#A51F2B]" /><h2 className="text-xl font-black">{item.razon_social}</h2></div><p className="mt-1 text-sm font-bold text-[#4B2818]/65">{item.rut} · {item.contacto_nombre} · {item.email} · {item.telefono}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${item.estado === 'aprobado' ? 'bg-emerald-100 text-emerald-800' : item.estado === 'pendiente' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>{item.estado}</span></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2"><div className="rounded-xl bg-[#FFF9EF] p-4 text-sm"><p className="font-black">Dirección empresa</p><p>{item.empresa_direccion}, {item.empresa_comuna}, {item.empresa_ciudad}, {item.empresa_region}</p></div><div className="rounded-xl bg-[#FFF9EF] p-4 text-sm"><p className="flex items-center gap-2 font-black"><Truck className="h-4 w-4" />Dirección despacho</p><p>{item.despacho_a_empresa ? 'Usa la dirección de la empresa' : `${item.despacho_direccion}, ${item.despacho_comuna}, ${item.despacho_ciudad}, ${item.despacho_region}`}</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="grid gap-1 text-xs font-black">Estado<select value={item.estado} onChange={(e) => cambiar(item.id, { estado: e.target.value as Mayorista['estado'] })} className="h-10 rounded-lg border bg-white px-2"><option value="pendiente">Pendiente</option><option value="aprobado">Aprobado</option><option value="rechazado">Rechazado</option><option value="suspendido">Suspendido</option></select></label><label className="grid gap-1 text-xs font-black">Descuento general %<input type="number" min="0" max="100" value={item.descuento_porcentaje} onChange={(e) => cambiar(item.id, { descuento_porcentaje: Number(e.target.value) })} className="h-10 rounded-lg border px-3 text-right" /></label><label className="grid gap-1 text-xs font-black">Pedido mínimo<input type="number" min="0" value={item.pedido_minimo} onChange={(e) => cambiar(item.id, { pedido_minimo: Number(e.target.value) })} className="h-10 rounded-lg border px-3 text-right" /></label><label className="flex h-10 items-center gap-2 self-end rounded-lg border px-3 text-xs font-black"><input type="checkbox" checked={item.despacho_habilitado} onChange={(e) => cambiar(item.id, { despacho_habilitado: e.target.checked })} />Despacho habilitado</label></div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2"><label className="grid gap-1 text-xs font-black">Condición de pago<input value={item.condicion_pago || ''} onChange={(e) => cambiar(item.id, { condicion_pago: e.target.value })} className="h-10 rounded-lg border px-3" /></label><label className="grid gap-1 text-xs font-black">Observaciones internas<input value={item.observaciones_internas || ''} onChange={(e) => cambiar(item.id, { observaciones_internas: e.target.value })} className="h-10 rounded-lg border px-3" /></label></div>
      <div className="mt-4 flex justify-end"><button onClick={() => void guardar(item)} disabled={guardando === item.id} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#A51F2B] px-5 text-sm font-black text-white disabled:opacity-50">{guardando === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Guardar y notificar</button></div>
    </article>)}</div>}
  </div>;
}
