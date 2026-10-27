'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdminSession } from '@/components/AdminSession';

type Fila = { id:number; codigo:string|null; nombre:string; categoria:string|null; precio:number; precio_10:number|null; precio_15:number|null; precio_20:number|null; precio_25:number|null };
type Precio = { producto_id:number; precio:number; precio_10:number|null; precio_15:number|null; precio_20:number|null; precio_25:number|null };
const campos = ['precio','precio_10','precio_15','precio_20','precio_25'] as const;
const dinero = (valor:number|null|undefined) => valor ? `$${Math.round(valor).toLocaleString('es-CL')}` : '';
const numero = (valor:string) => Number(valor.replace(/\D/g,'')) || 0;

export default function PreciosWhatsapp5041Page() {
  const { perfil } = useAdminSession();
  const [productos,setProductos]=useState<Fila[]>([]);
  const [precios,setPrecios]=useState<Record<number,Precio>>({});
  const [buscar,setBuscar]=useState('');
  const [cargando,setCargando]=useState(true);
  const [guardando,setGuardando]=useState(false);

  useEffect(()=>{ if(!perfil) return; void (async()=>{
    setCargando(true);
    const [{data:p,error:e1},{data:l,error:e2}] = await Promise.all([
      supabase.from('productos').select('id,codigo,nombre,categoria,precio,precio_10,precio_15,precio_20,precio_25,familias_productos!inner(activo,mostrar_catalogo)').eq('empresa_id',perfil.empresa_id).eq('tipo_producto','producto').eq('activo',true).eq('familias_productos.activo',true).eq('familias_productos.mostrar_catalogo',true).not('codigo','is',null).gt('precio',0).order('nombre'),
      supabase.from('producto_precios_whatsapp').select('producto_id,precio,precio_10,precio_15,precio_20,precio_25').eq('empresa_id',perfil.empresa_id).eq('canal','5041')
    ]);
    if(e1||e2) alert(e1?.message||e2?.message);
    const lista=(p||[]) as Fila[]; setProductos(lista);
    const existentes=Object.fromEntries(((l||[]) as Precio[]).map(item=>[item.producto_id,item]));
    setPrecios(Object.fromEntries(lista.map(item=>[item.id,existentes[item.id]||{producto_id:item.id,precio:item.precio,precio_10:item.precio_10,precio_15:item.precio_15,precio_20:item.precio_20,precio_25:item.precio_25}])));
    setCargando(false);
  })(); },[perfil]);

  const visibles=useMemo(()=>{const q=buscar.toLocaleLowerCase('es');return productos.filter(p=>`${p.codigo||''} ${p.nombre}`.toLocaleLowerCase('es').includes(q));},[productos,buscar]);
  const cambiar=(id:number,campo:typeof campos[number],valor:string)=>setPrecios(actual=>({...actual,[id]:{...actual[id],[campo]:valor.trim()?numero(valor):null}}));
  async function guardar(){ if(!perfil)return; setGuardando(true); const filas=Object.values(precios).map(p=>({empresa_id:perfil.empresa_id,canal:'5041',...p,precio:Number(p.precio||0)})); const {error}=await supabase.from('producto_precios_whatsapp').upsert(filas,{onConflict:'empresa_id,canal,producto_id'}); setGuardando(false); if(error)return alert(error.message); alert('Lista de precios 5041 guardada.'); }

  return <div className="space-y-5 pb-12"><header><p className="text-xs font-black uppercase text-[#A51F2B]">Catálogo independiente</p><h1 className="mt-1 text-3xl font-black text-[#2A1710]">Precios WhatsApp 5041</h1><p className="mt-2 text-sm font-bold text-[#4B2818]/70">Estos valores alimentan solo el catálogo del +56 9 6678 5041. No modifican el catálogo del 2447.</p></header><div className="flex gap-3"><label className="flex h-11 flex-1 items-center gap-2 rounded-lg border bg-white px-3"><Search className="h-4 w-4"/><input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar producto o código" className="min-w-0 flex-1 outline-none"/></label><button onClick={()=>void guardar()} disabled={guardando||cargando} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#A51F2B] px-5 font-black text-white"><Save className="h-4 w-4"/>{guardando?'Guardando…':'Guardar lista'}</button></div>{cargando?<p>Cargando…</p>:<div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-[900px] w-full text-sm"><thead className="bg-[#2A1710] text-white"><tr><th className="p-3 text-left">Producto</th><th>Base</th><th>10 pers.</th><th>15 pers.</th><th>20 pers.</th><th>25 pers.</th></tr></thead><tbody>{visibles.map(p=><tr key={p.id} className="border-b"><td className="p-3"><div className="font-black">{p.nombre}</div><div className="text-xs opacity-60">{p.codigo}</div></td>{campos.map(c=><td key={c} className="p-2"><input value={dinero(precios[p.id]?.[c])} onChange={e=>cambiar(p.id,c,e.target.value)} className="h-10 w-28 rounded border px-2 text-right font-black" placeholder="$0"/></td>)}</tr>)}</tbody></table></div>}<div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm font-bold"><p>Feed para el nuevo catálogo de Meta:</p><code className="mt-2 block break-all">https://panaderiamaruxa.cl/api/meta/catalogo?lista=5041</code></div></div>;
}
